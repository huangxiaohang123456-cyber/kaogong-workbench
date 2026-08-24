import { useState, useRef } from 'react'
import { uploadMaterial, deleteMaterial } from '../supabaseClient'
import { MAT_PURPOSES, MAT_EXAMS, MAT_SUBJECTS, matPurposeColor, uid, today } from '../data'

// 扩展名 → 文件类型
const TYPE_BY_EXT = {
  pdf: 'pdf',
  doc: 'word', docx: 'word',
  xls: 'excel', xlsx: 'excel', csv: 'excel',
  ppt: 'ppt', pptx: 'ppt',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image',
}
const TYPE_ICON = { pdf: '📕', word: '📘', excel: '📗', ppt: '📙', image: '🖼️', link: '🔗', other: '📄' }
const TYPE_LABEL = { pdf: 'PDF', word: 'Word', excel: 'Excel', ppt: 'PPT', image: '图片', link: '链接', other: '文件' }

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}
function fmtSize(b) {
  if (!b && b !== 0) return ''
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(0) + ' KB'
  return b + ' B'
}
// 预览地址：PDF 直接内嵌；Office 三类走微软在线预览；图片直接显示；其余返回 null（只能下载）
function previewSrc(f) {
  if (!f) return null
  if (f.type === 'pdf') return f.url
  if (f.type === 'image') return f.url
  if (['word', 'excel', 'ppt'].includes(f.type)) {
    return 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(f.url)
  }
  return null
}

// 用途选择器（彩色 chips + 可自定义）
function PurposePicker({ value, onChange }) {
  const [custom, setCustom] = useState('')
  return (
    <div>
      <div className="mat-purposes">
        {MAT_PURPOSES.map((p) => (
          <button
            key={p.key}
            type="button"
            className={'mat-pur' + (value === p.key ? ' on' : '')}
            style={value === p.key ? { background: p.color, borderColor: p.color, color: '#fff' } : { borderColor: p.color, color: p.color }}
            onClick={() => onChange(p.key)}
          >
            {p.key}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          list="mat-custom-purpose"
          placeholder="或输入自定义用途，如：思维导图"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <datalist id="mat-custom-purpose">
          {MAT_PURPOSES.map((p) => <option key={p.key} value={p.key} />)}
        </datalist>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={!custom.trim()}
          onClick={() => { if (custom.trim()) { onChange(custom.trim()); setCustom('') } }}
        >用这个</button>
      </div>
    </div>
  )
}

export function Materials({ s, up, toast, user }) {
  const files = s.materials || []
  const [purposeFilter, setPurposeFilter] = useState('all')
  const [examFilter, setExamFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [pending, setPending] = useState(null) // 待确认上传：{items, purpose, exam, subject, note}
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null) // 预览中的文件
  const [editing, setEditing] = useState(null) // 编辑中的文件
  const fileRef = useRef(null)
  const [linking, setLinking] = useState(false)
  const [linkDraft, setLinkDraft] = useState({ name: '', url: '', purpose: '其他', exam: '', subject: '', note: '' })
  const [bigWarn, setBigWarn] = useState(null)

  const filtered = files.filter((f) =>
    (purposeFilter === 'all' || f.purpose === purposeFilter) &&
    (examFilter === 'all' || (f.exam || '') === examFilter) &&
    (subjectFilter === 'all' || (f.subject || '') === subjectFilter)
  )

  const onPick = (e) => {
    const list = Array.from(e.target.files || [])
    if (!list.length) return
    const items = list.map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      type: TYPE_BY_EXT[extOf(f.name)] || 'other',
    }))
    const MAX = 50 * 1024 * 1024
    const big = list.reduce((a, f) => (f.size > (a?.size || 0) ? f : a), null)
    setBigWarn(big && big.size > MAX ? big.name : null)
    setPending({ items, purpose: '其他', exam: '', subject: '', note: '' })
    e.target.value = ''
  }

  const doUpload = async () => {
    if (!pending) return
    if (!user || !user.id) { toast('未登录，无法上传'); return }
    setUploading(true)
    try {
      const metas = []
      for (const it of pending.items) {
        const { path, url } = await uploadMaterial(user.id, it.file)
        metas.push({
          id: uid(),
          name: it.name,
          type: it.type,
          size: it.size,
          path,
          url,
          purpose: pending.purpose || '其他',
          exam: pending.exam || '',
          subject: pending.subject || '',
          note: pending.note || '',
          createdAt: today(),
        })
      }
      up((prev) => ({ ...prev, materials: [...metas, ...(prev.materials || [])] }))
      toast(`已上传 ${metas.length} 个资料`)
      setPending(null)
    } catch (err) {
      toast('上传失败：' + (err.message || err))
    } finally {
      setUploading(false)
    }
  }

  const onDelete = async (f) => {
    if (!confirm(`确定删除「${f.name}」？此操作不可恢复`)) return
    try {
      if (f.path) await deleteMaterial(f.path)
    } catch (e) { /* 即使存储删除失败也清理元数据 */ }
    up((prev) => ({ ...prev, materials: (prev.materials || []).filter((x) => x.id !== f.id) }))
    toast('已删除')
  }

  const saveEdit = (next) => {
    up((prev) => ({ ...prev, materials: (prev.materials || []).map((x) => (x.id === next.id ? next : x)) }))
    setEditing(null)
    toast('已更新')
  }

  const saveLink = () => {
    if (!linkDraft.name.trim() || !linkDraft.url.trim()) { toast('请填写名称和链接'); return }
    const meta = {
      id: uid(),
      name: linkDraft.name.trim(),
      type: 'link',
      isLink: true,
      url: linkDraft.url.trim(),
      purpose: linkDraft.purpose || '其他',
      exam: linkDraft.exam || '',
      subject: linkDraft.subject || '',
      note: linkDraft.note || '',
      createdAt: today(),
    }
    up((prev) => ({ ...prev, materials: [meta, ...(prev.materials || [])] }))
    setLinkDraft({ name: '', url: '', purpose: '其他', exam: '', subject: '', note: '' })
    setLinking(false)
    toast('已添加链接资料')
  }

  const toLinkFromBig = () => {
    const name = bigWarn || ''
    setPending(null)
    setBigWarn(null)
    setLinkDraft({ name, url: '', purpose: '其他', exam: '', subject: '', note: '' })
    setLinking(true)
  }

  const psrc = previewSrc(preview)
  const usedExams = Array.from(new Set(files.map((f) => f.exam).filter(Boolean)))
  const usedSubjects = Array.from(new Set(files.map((f) => f.subject).filter(Boolean)))

  return (
    <div className="materials">
      {/* 顶部：筛选 + 上传 */}
      <div className="mat-toolbar">
        <div className="mat-filters">
          <div className="mat-filter-row">
            <span className="mat-fl">用途</span>
            <div className="mat-purposes">
              <button className={'mat-pur' + (purposeFilter === 'all' ? ' on' : '')} onClick={() => setPurposeFilter('all')}>全部</button>
              {MAT_PURPOSES.map((p) => (
                <button
                  key={p.key}
                  className={'mat-pur' + (purposeFilter === p.key ? ' on' : '')}
                  style={purposeFilter === p.key ? { background: p.color, borderColor: p.color, color: '#fff' } : { borderColor: p.color, color: p.color }}
                  onClick={() => setPurposeFilter(purposeFilter === p.key ? 'all' : p.key)}
                >{p.key}</button>
              ))}
            </div>
          </div>
          <div className="mat-filter-row">
            <span className="mat-fl">考试</span>
            <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
              <option value="all">全部</option>
              {MAT_EXAMS.concat(usedExams.filter((x) => !MAT_EXAMS.includes(x))).map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <span className="mat-fl" style={{ marginLeft: 10 }}>科目</span>
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="all">全部</option>
              {MAT_SUBJECTS.concat(usedSubjects.filter((x) => !MAT_SUBJECTS.includes(x))).map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
        <div className="mat-upload-btns">
          <button className="btn-primary" onClick={() => fileRef.current && fileRef.current.click()}>＋ 上传资料</button>
          <button className="btn-ghost" onClick={() => setLinking(true)}>＋ 添加链接</button>
        </div>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={onPick} />
      </div>

      {/* 统计 */}
      <div className="mat-stats">
        <span>共 {files.length} 个资料</span>
        {purposeFilter !== 'all' && <span className="tag" style={{ background: matPurposeColor(purposeFilter), color: '#fff' }}>{purposeFilter}</span>}
        {filtered.length !== files.length && <span className="muted">（筛选后 {filtered.length} 个）</span>}
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="mat-empty">
          <div style={{ fontSize: 38 }}>📁</div>
          <p>{files.length === 0 ? '还没有资料，点「上传资料」把题本/计划表/网课本/题目电子版传上来' : '没有符合筛选条件的资料'}</p>
        </div>
      ) : (
        <div className="mat-grid">
          {filtered.map((f) => (
            <div className="mat-card" key={f.id}>
              <span className="mat-purpose" style={{ background: matPurposeColor(f.purpose), color: '#fff' }}>{f.purpose || '其他'}</span>
              <div className="mat-name">
                <span className="mat-ic">{TYPE_ICON[f.type] || '📄'}</span>
                <span className="mat-nm" title={f.name}>{f.name}</span>
              </div>
              <div className="mat-meta">
                <span>{TYPE_LABEL[f.type] || '文件'}</span>
                {f.size ? <span>· {fmtSize(f.size)}</span> : null}
                {f.createdAt ? <span>· {f.createdAt}</span> : null}
              </div>
              {(f.exam || f.subject) && (
                <div className="mat-tags">
                  {f.exam ? <span className="tag">{f.exam}</span> : null}
                  {f.subject ? <span className="tag gray">{f.subject}</span> : null}
                </div>
              )}
              {f.note ? <div className="mat-note">{f.note}</div> : null}
              {f.isLink && f.url ? (
                <a className="mat-link" href={f.url} target="_blank" rel="noreferrer" title={f.url}>{f.url}</a>
              ) : null}
              <div className="mat-actions">
                {f.isLink ? (
                  <a className="btn-ghost btn-sm" href={f.url} target="_blank" rel="noreferrer">打开链接</a>
                ) : (
                  <>
                    <button className="btn-ghost btn-sm" onClick={() => setPreview(f)}>预览</button>
                    <a className="btn-ghost btn-sm" href={f.url} download={f.name}>下载</a>
                  </>
                )}
                <button className="btn-ghost btn-sm" onClick={() => setEditing(f)}>编辑</button>
                <button className="btn-danger btn-sm" onClick={() => onDelete(f)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 上传确认弹窗 */}
      {pending && (
        <div className="modal-mask" onClick={() => { if (!uploading) { setPending(null); setBigWarn(null) } }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>确认资料信息</h3>
            <p className="login-sub">已选择 {pending.items.length} 个文件，给它们统一打上标签（之后可在卡片上「编辑」单独改）。</p>
            {bigWarn && (
              <div className="mat-warn">
                <div>⚠️ 「{bigWarn}」超过 50MB，免费存储桶单文件上限约 50MB，无法直接存入。建议改用「添加链接」登记网盘链接。</div>
                <button className="btn-sm btn-ghost" onClick={toLinkFromBig}>转为添加链接</button>
              </div>
            )}
            <div style={{ maxHeight: 150, overflow: 'auto', margin: '10px 0', padding: 10, background: 'var(--bg2)', borderRadius: 10 }}>
              {pending.items.map((it, i) => (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--ink2)', padding: '3px 0', display: 'flex', gap: 8 }}>
                  <span>{TYPE_ICON[it.type] || '📄'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                  <span className="muted">{fmtSize(it.size)}</span>
                </div>
              ))}
            </div>
            <div className="field">
              <label>用途（最关键，一眼看出是干嘛的）</label>
              <PurposePicker value={pending.purpose} onChange={(v) => setPending((p) => ({ ...p, purpose: v }))} />
            </div>
            <div className="field">
              <label>考试（可选）</label>
              <input list="mat-exam-list" placeholder="如：国考" value={pending.exam} onChange={(e) => setPending((p) => ({ ...p, exam: e.target.value }))} />
              <datalist id="mat-exam-list">{MAT_EXAMS.map((x) => <option key={x} value={x} />)}</datalist>
            </div>
            <div className="field">
              <label>科目（可选）</label>
              <input list="mat-subject-list" placeholder="如：资料" value={pending.subject} onChange={(e) => setPending((p) => ({ ...p, subject: e.target.value }))} />
              <datalist id="mat-subject-list">{MAT_SUBJECTS.map((x) => <option key={x} value={x} />)}</datalist>
            </div>
            <div className="field">
              <label>备注（可选）</label>
              <input placeholder="如：2024版系统班配套" value={pending.note} onChange={(e) => setPending((p) => ({ ...p, note: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-ghost btn-block" disabled={uploading} onClick={() => { setPending(null); setBigWarn(null) }}>取消</button>
              <button className="btn-primary btn-block" disabled={uploading} onClick={doUpload}>{uploading ? '上传中…' : `上传 ${pending.items.length} 个`}</button>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {preview && (
        <div className="modal-mask" onClick={() => setPreview(null)}>
          <div className="modal mat-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mat-preview-head">
              <span className="mat-purpose" style={{ background: matPurposeColor(preview.purpose), color: '#fff' }}>{preview.purpose || '其他'}</span>
              <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={preview.name}>{preview.name}</strong>
              <button className="mat-x" onClick={() => setPreview(null)} aria-label="关闭">✕</button>
            </div>
            {psrc ? (
              preview.type === 'image' ? (
                <img className="mat-preview-body" src={preview.url} alt={preview.name} />
              ) : (
                <iframe className="mat-preview-body" src={psrc} title={preview.name} />
              )
            ) : (
              <div className="mat-preview-fallback">
                <div style={{ fontSize: 40 }}>{TYPE_ICON[preview.type] || '📄'}</div>
                <p>该类型暂不支持在线预览，请下载后查看。</p>
                <a className="btn-primary" href={preview.url} download={preview.name}>下载「{preview.name}」</a>
              </div>
            )}
            <div className="mat-preview-foot">
              <a className="btn-ghost btn-sm" href={preview.url} download={preview.name}>下载</a>
              {psrc && preview.type !== 'image' && (
                <a className="btn-ghost btn-sm" href={'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(preview.url)} target="_blank" rel="noreferrer">新窗口打开</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <div className="modal-mask" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>编辑资料信息</h3>
            <p className="login-sub" style={{ marginBottom: 10 }}>{editing.name}</p>
            {editing.isLink && (
              <div className="field">
                <label>链接</label>
                <input placeholder="链接地址" value={editing.url || ''} onChange={(e) => setEditing((p) => ({ ...p, url: e.target.value }))} />
              </div>
            )}
            <div className="field">
              <label>用途</label>
              <PurposePicker value={editing.purpose} onChange={(v) => setEditing((p) => ({ ...p, purpose: v }))} />
            </div>
            <div className="field">
              <label>考试（可选）</label>
              <input list="mat-exam-list2" placeholder="如：国考" value={editing.exam || ''} onChange={(e) => setEditing((p) => ({ ...p, exam: e.target.value }))} />
              <datalist id="mat-exam-list2">{MAT_EXAMS.map((x) => <option key={x} value={x} />)}</datalist>
            </div>
            <div className="field">
              <label>科目（可选）</label>
              <input list="mat-subject-list2" placeholder="如：资料" value={editing.subject || ''} onChange={(e) => setEditing((p) => ({ ...p, subject: e.target.value }))} />
              <datalist id="mat-subject-list2">{MAT_SUBJECTS.map((x) => <option key={x} value={x} />)}</datalist>
            </div>
            <div className="field">
              <label>备注（可选）</label>
              <input placeholder="如：2024版系统班配套" value={editing.note || ''} onChange={(e) => setEditing((p) => ({ ...p, note: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-ghost btn-block" onClick={() => setEditing(null)}>取消</button>
              <button className="btn-primary btn-block" onClick={() => saveEdit(editing)}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 添加链接弹窗 */}
      {linking && (
        <div className="modal-mask" onClick={() => setLinking(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>添加链接资料</h3>
            <p className="login-sub">用于记录本机/网盘里的大文件（如整本课本、真题卷）。这里只存名称和打开方式，不占用存储桶。<b>手机上请填网盘分享链接</b>（如百度网盘/OneDrive），电脑本地路径（file:///...）只有同一台电脑能打开。</p>
            <div className="field">
              <label>名称</label>
              <input placeholder="如：2024行测系统班教材PDF" value={linkDraft.name} onChange={(e) => setLinkDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="field">
              <label>链接（本机路径或网盘分享链接）</label>
              <input placeholder="如：file:///D:/资料/行测教材.pdf 或 百度网盘链接" value={linkDraft.url} onChange={(e) => setLinkDraft((d) => ({ ...d, url: e.target.value }))} />
            </div>
            <div className="field">
              <label>用途</label>
              <PurposePicker value={linkDraft.purpose} onChange={(v) => setLinkDraft((d) => ({ ...d, purpose: v }))} />
            </div>
            <div className="field">
              <label>考试（可选）</label>
              <input list="mat-exam-list3" placeholder="如：国考" value={linkDraft.exam} onChange={(e) => setLinkDraft((d) => ({ ...d, exam: e.target.value }))} />
              <datalist id="mat-exam-list3">{MAT_EXAMS.map((x) => <option key={x} value={x} />)}</datalist>
            </div>
            <div className="field">
              <label>科目（可选）</label>
              <input list="mat-subject-list3" placeholder="如：资料" value={linkDraft.subject} onChange={(e) => setLinkDraft((d) => ({ ...d, subject: e.target.value }))} />
              <datalist id="mat-subject-list3">{MAT_SUBJECTS.map((x) => <option key={x} value={x} />)}</datalist>
            </div>
            <div className="field">
              <label>备注（可选）</label>
              <input placeholder="如：放在D盘备考资料夹" value={linkDraft.note} onChange={(e) => setLinkDraft((d) => ({ ...d, note: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-ghost btn-block" onClick={() => setLinking(false)}>取消</button>
              <button className="btn-primary btn-block" onClick={saveLink}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

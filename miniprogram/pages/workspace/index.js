"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../services/api");
const subs = ['语文', '数学', '英语'];
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const opt = (rows, label = 'name') => rows.map(x => ({ label: x[label], value: x.id }));
const choices = (values) => values.map(x => ({ label: x, value: x }));
Page({
    data: { loading: false, saving: false, error: '', notice: '', tab: 'today', session: null, dash: null, detail: null, selectedId: '', date: today(), form: null, formError: '', demo: (0, api_1.isLocalDemo)(), personaIndex: 0, personas: ['管理员 / 主责老师', '数学老师', '小禾与小宁家长', '小川家长'], tabs: [{ id: 'today', name: '今日工作台' }, { id: 'homework', name: '同班作业' }, { id: 'student', name: '学生档案' }, { id: 'scores', name: '成绩记录' }, { id: 'feedback', name: '反馈与跟进' }, { id: 'admin', name: '机构管理' }], subject: '数学', subjectIndex: 1, subjects: subs, scoreType: '全部', scoreTypes: ['全部', '单元测验', '期中', '期末', '其他'], scoreTypeIndex: 0, rangeStart: '', rangeEnd: '', scoreRows: [], chartPoints: [], selectedStudents: [], filters: {}, privacy: false },
    async onLoad() { await this.refresh(); },
    async onPullDownRefresh() { await this.refresh(); wx.stopPullDownRefresh(); },
    async refresh() {
        var _a;
        this.setData({ loading: true, error: '' });
        try {
            const session = await (0, api_1.api)('session');
            const dash = await (0, api_1.api)('dashboard', { date: this.data.date, ...this.data.filters });
            const staff = session.user.roles.some((r) => r !== 'parent');
            let selectedId = this.data.selectedId;
            if (!dash.students.some((s) => s.id === selectedId))
                selectedId = ((_a = dash.students[0]) === null || _a === void 0 ? void 0 : _a.id) || '';
            const className = (id) => { var _a; return ((_a = dash.classes.find((c) => c.id === id)) === null || _a === void 0 ? void 0 : _a.name) || ''; };
            const schoolName = (id) => { var _a; return ((_a = dash.schools.find((c) => c.id === id)) === null || _a === void 0 ? void 0 : _a.name) || ''; };
            dash.students = dash.students.map((s) => { var _a; return ({ ...s, className: className(s.classId), schoolName: schoolName(s.schoolId), attendance: ((_a = dash.attendance.find((a) => a.studentId === s.id)) === null || _a === void 0 ? void 0 : _a.status) || '未到店', daily: subs.map(subject => { const ts = dash.tasks.filter((t) => t.studentId === s.id && t.subject === subject); return { subject, text: ts.length ? ts.map((t) => t.status + (t.help ? '·需要帮助' : '')).join(' / ') : '待核实（尚未录入）' }; }) }); });
            dash.todoCounts = { check: dash.tasks.filter((t) => t.status === '待检查').length, help: dash.tasks.filter((t) => t.help).length, review: dash.tasks.filter((t) => t.status === '订正中').length, left: dash.tasks.filter((t) => t.status === '有遗留事项').length };
            this.setData({ session, dash, staff, admin: session.user.roles.includes('admin'), demo: (0, api_1.isLocalDemo)() || session.demo, selectedId, selectedStudents: [], privacy: !!wx.getStorageSync('zimo-privacy-accepted') });
            await this.loadStudent();
        }
        catch (e) {
            this.setData({ error: e.message });
        }
        finally {
            this.setData({ loading: false });
        }
    },
    async loadStudent() { if (!this.data.selectedId) {
        this.setData({ detail: null });
        return;
    } const selectedId = this.data.selectedId; this.setData({ detail: null }); try {
        const detail = await (0, api_1.api)('student', { studentId: selectedId });
        if (selectedId !== this.data.selectedId)
            return;
        const hw = new Map(detail.homework.map((h) => [h.id, h]));
        detail.dailyTasks = detail.tasks.filter((t) => t.date === this.data.date).map((t) => { var _a, _b; return ({ ...t, content: ((_a = hw.get(t.homeworkId)) === null || _a === void 0 ? void 0 : _a.content) || '', source: ((_b = hw.get(t.homeworkId)) === null || _b === void 0 ? void 0 : _b.source) || '待核实' }); });
        for (const subject of subs)
            if (!detail.dailyTasks.some((t) => t.subject === subject))
                detail.dailyTasks.push({ id: 'missing-' + subject, subject, status: '待核实', content: '尚未录入，请核实该科作业来源。', source: '待核实', missing: true });
        detail.todayFeedback = detail.feedback.filter((f) => f.published && f.date === this.data.date);
        detail.historyFeedback = detail.feedback.filter((f) => f.date !== this.data.date || !f.published);
        detail.activeGoals = detail.goals.filter((g) => g.date <= this.data.date && g.endDate >= this.data.date);
        detail.currentAttendance = detail.attendance.find((a) => a.date === this.data.date) || { status: '未到店' };
        this.setData({ detail });
        this.updateScores();
    }
    catch (e) {
        this.setData({ error: e.message });
    } },
    async selectStudent(e) { this.setData({ selectedId: e.currentTarget.dataset.id, error: '' }); await this.loadStudent(); },
    async switchPersona(e) { const index = Number(e.detail.value); (0, api_1.setPersona)(['admin', 'teacher', 'parent', 'other'][index]); this.setData({ personaIndex: index, selectedId: '', filters: {}, tab: 'today', session: null, dash: null, detail: null, scoreRows: [] }); await this.refresh(); },
    tab(e) { this.setData({ tab: e.currentTarget.dataset.id }); if (this.data.tab === 'scores')
        this.updateScores(); },
    async changeDate(e) { this.setData({ date: e.detail.value }); await this.refresh(); },
    acceptPrivacy() { wx.setStorageSync('zimo-privacy-accepted', true); this.setData({ privacy: true }); },
    privacyInfo() { wx.showModal({ title: '隐私与数据使用', content: '用于辅导服务的学生档案、监护绑定、作业、成绩、必要情绪事实和图片仅供获授权人员查看。内部情绪记录不直接向家长展示。可联系机构申请更正、导出或删除；正式上线须在微信后台配置主体、处理者联系方式、保存期限及隐私保护指引。本演示使用虚构数据。', showCancel: false }); },
    async submit(action, data) { if (this.data.saving)
        return; this.setData({ saving: true, error: '', formError: '', notice: '' }); try {
        const result = await (0, api_1.api)(action, data);
        this.setData({ notice: '保存成功', form: null });
        await this.refresh();
        return result;
    }
    catch (e) {
        const message = e.message;
        this.setData({ error: message, formError: message });
        wx.showToast({ title: '保存失败，请查看提示', icon: 'none' });
        return null;
    }
    finally {
        this.setData({ saving: false });
    } },
    open(title, action, fields, base = {}) { this.setData({ form: { title, action, fields: fields.map(f => { var _a, _b; return ({ type: 'text', value: '', ...f, ...(f.type === 'select' ? { label: ((_b = (_a = f.options) === null || _a === void 0 ? void 0 : _a.find((o) => o.value === f.value)) === null || _b === void 0 ? void 0 : _b.label) || '' } : {}) }); }), base }, formError: '', notice: '' }); },
    cancelForm() { if (!this.data.saving)
        this.setData({ form: null }); },
    fieldInput(e) { this.setData({ [`form.fields[${e.currentTarget.dataset.index}].value`]: e.detail.value }); },
    fieldPick(e) { const index = e.currentTarget.dataset.index; const options = this.data.form.fields[index].options; this.setData({ [`form.fields[${index}].value`]: options[Number(e.detail.value)].value, [`form.fields[${index}].label`]: options[Number(e.detail.value)].label }); },
    fieldSwitch(e) { this.setData({ [`form.fields[${e.currentTarget.dataset.index}].value`]: e.detail.value }); },
    async saveForm() {
        const f = this.data.form;
        const data = { ...f.base };
        for (const field of f.fields) {
            if (field.type === 'number' && (field.value === null || field.value === undefined || String(field.value).trim() === '')) {
                this.setData({ formError: '请填写' + field.name + '，缺失数据不能记作零。' });
                return;
            }
            data[field.key] = field.type === 'number' ? Number(field.value) : field.value;
        }
        if (f.action === 'adminSave') {
            data.record = {};
            for (const field of f.fields)
                data.record[field.key] = data[field.key];
            if (data.table === 'students') {
                data.record.assignments = { 语文: data.record.chinese, 数学: data.record.math, 英语: data.record.english };
                delete data.record.chinese;
                delete data.record.math;
                delete data.record.english;
                const c = this.data.dash.classes.find((c) => c.id === data.record.classId);
                if (c)
                    Object.assign(data.record, { schoolId: c.schoolId, grade: c.grade, schoolYear: c.schoolYear });
                data.record.active = data.record.active !== false;
            }
            if (data.table === 'users') {
                data.record.roles = String(data.record.roles).split(',').map((x) => x.trim());
                if (data.record.accountId) {
                    data.id = data.record.accountId;
                    delete data.record.accountId;
                }
            }
            if (data.table === 'classes') {
                data.record.grade = Number(data.record.grade);
                data.record.schoolYear = Number(data.record.schoolYear);
            }
            for (const field of f.fields)
                delete data[field.key];
        }
        if (f.action === 'publishHomework') {
            data.studentIds = this.data.selectedStudents;
            if (!data.studentIds.length) {
                this.setData({ formError: '请先在列表勾选学生，再发布作业。' });
                return;
            }
        }
        if (['feedbackPublish', 'reviseHomework', 'bindingVerify'].includes(f.action)) {
            const confirmed = await new Promise(resolve => wx.showModal({ title: '请核对后确认', content: f.action === 'reviseHomework' ? `修改将影响 ${f.base.count} 位学生；保留每人的现有进度。` : '确认内容准确并由你负责本次操作？', success: r => resolve(r.confirm) }));
            if (!confirmed)
                return;
            data.confirm = true;
            delete data.count;
        }
        const r = await this.submit(f.action, data);
        if (r === null || r === void 0 ? void 0 : r.code)
            wx.showModal({ title: '24小时有效邀请', content: r.code + '\n申请后需机构线下核验。', confirmText: '复制邀请码', success: x => { if (x.confirm)
                    wx.setClipboardData({ data: r.code }); } });
    },
    selectBatch(e) { const id = e.currentTarget.dataset.id; const prev = this.data.selectedStudents; const selectedStudents = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]; this.setData({ selectedStudents, 'dash.students': this.data.dash.students.map((s) => ({ ...s, selected: selectedStudents.includes(s.id) })) }); },
    selectPresent() { const selectedStudents = this.data.dash.students.filter((s) => s.attendance === '已到店').map((s) => s.id); this.setData({ selectedStudents, 'dash.students': this.data.dash.students.map((s) => ({ ...s, selected: selectedStudents.includes(s.id) })) }); },
    filter() { const d = this.data.dash; this.open('工作台筛选', '_filter', [{ key: 'schoolId', name: '学校', type: 'select', options: [{ label: '全部学校', value: '' }, ...opt(d.schools)] }, { key: 'grade', name: '年级', type: 'select', options: [{ label: '全部年级', value: '' }, ...Array.from({ length: 6 }, (_, i) => ({ label: (i + 1) + '年级', value: i + 1 }))] }, { key: 'classId', name: '学校班级', type: 'select', options: [{ label: '全部班级', value: '' }, ...opt(d.classes)] }, { key: 'subject', name: '科目', type: 'select', options: [{ label: '全部科目', value: '' }, ...choices(subs)] }, { key: 'leadId', name: '主责老师', type: 'select', options: [{ label: '全部老师', value: '' }, ...opt(d.teachers || [])] }]); },
    async saveClick() { if (this.data.form.action === '_filter') {
        const filters = {};
        for (const f of this.data.form.fields)
            if (f.value)
                filters[f.key] = f.value;
        this.setData({ filters, form: null });
        await this.refresh();
        return;
    } await this.saveForm(); },
    async clearFilters() { this.setData({ filters: {} }); await this.refresh(); },
    publishHomework(e) { const h = e.currentTarget.dataset.id ? this.data.dash.homework.find((x) => x.id === e.currentTarget.dataset.id) : null; this.open(h ? '复制作业后发布' : '同班作业批量发布', 'publishHomework', [{ key: 'date', name: '作业日期', type: 'date', value: this.data.date }, { key: 'classId', name: '学校班级', type: 'select', options: this.data.dash.classes.map((c) => { var _a; return ({ value: c.id, label: `${c.schoolYear} ${(_a = this.data.dash.schools.find((s) => s.id === c.schoolId)) === null || _a === void 0 ? void 0 : _a.name} ${c.name}` }); }), value: (h === null || h === void 0 ? void 0 : h.classId) || '' }, { key: 'subject', name: '科目', type: 'select', options: choices(subs), value: (h === null || h === void 0 ? void 0 : h.subject) || '数学', label: (h === null || h === void 0 ? void 0 : h.subject) || '数学' }, { key: 'content', name: '共同作业内容', type: 'textarea', value: (h === null || h === void 0 ? void 0 : h.content) || '' }, { key: 'source', name: '来源（不明确请留空）', value: (h === null || h === void 0 ? void 0 : h.source) || '' }, { key: 'verified', name: '已核实来源', type: 'switch', value: !!(h === null || h === void 0 ? void 0 : h.verified) }]); },
    reviseHomework(e) { const h = this.data.dash.homework.find((h) => h.id === e.currentTarget.dataset.id); this.open('修改已发布共同作业', 'reviseHomework', [{ key: 'content', name: '作业新内容', type: 'textarea', value: h.content }], { id: h.id, version: h.revision, count: this.data.dash.tasks.filter((t) => t.homeworkId === h.id).length }); },
    taskEdit(e) { const t = this.data.detail.dailyTasks.find((x) => x.id === e.currentTarget.dataset.id); this.open('个人任务记录 · ' + t.subject, 'taskUpdate', [{ key: 'status', name: '状态', type: 'select', options: choices(['待核实', '未开始', '进行中', '待检查', '检查通过', '订正中', '订正已复核', '有遗留事项']), value: t.status, label: t.status }, { key: 'help', name: '需要帮助（独立标记）', type: 'switch', value: t.help }, { key: 'exception', name: '个人例外', type: 'select', options: choices(['', '分层作业', '请假补做', '免做', '个人订正', '约定家庭加练']), value: t.exception || '' }, { key: 'note', name: '个人说明', type: 'textarea', value: t.note || '' }, { key: 'confirm', name: '我已亲自检查／复核或核实来源', type: 'switch', value: false }], { id: t.id, version: t.version }); },
    attendance() { this.open('记录到离店', 'attendanceSave', [{ key: 'status', name: '状态', type: 'select', options: choices(['未到店', '已到店', '已离店', '请假']) }], { studentId: this.data.selectedId, date: this.data.date }); },
    addScore() { this.open('录入真实成绩（缺失不录入）', 'scoreSave', [{ key: 'date', name: '考试日期', type: 'date', value: this.data.date }, { key: 'subject', name: '科目', type: 'select', options: choices(subs) }, { key: 'name', name: '考试名称' }, { key: 'type', name: '考试类型', type: 'select', options: choices(['单元测验', '期中', '期末', '其他']) }, { key: 'score', name: '原始得分', type: 'number' }, { key: 'full', name: '满分', type: 'number', value: 100 }, { key: 'scope', name: '考查范围' }, { key: 'source', name: '成绩来源' }, { key: 'verified', name: '已核验', type: 'switch', value: false }, { key: 'note', name: '备注', type: 'textarea' }], { studentId: this.data.selectedId }); },
    addMistake() { this.open('重点问题跟进卡', 'mistakeSave', [{ key: 'date', name: '发现日期', type: 'date', value: this.data.date }, { key: 'subject', name: '科目', type: 'select', options: choices(subs) }, { key: 'location', name: '题目位置（可另上传照片）' }, { key: 'fileId', name: '附件编号（上传后自动填写，可留空）' }, { key: 'knowledge', name: '知识点' }, { key: 'symptom', name: '可观察的错误表现', type: 'textarea' }, { key: 'support', name: '已采取的提示或补讲', type: 'textarea' }, { key: 'result', name: '当日同类题验证', type: 'select', options: choices(['未验证', '独立通过', '提示后完成', '仍需支持']) }, { key: 'reviewDate', name: '下次复查日期', type: 'date', value: this.data.date }], { studentId: this.data.selectedId }); },
    review(e) { this.open('后续复查（与原题订正分开记录）', 'reviewSave', [{ key: 'result', name: '独立验证结果', type: 'select', options: choices(['未验证', '独立通过', '提示后完成', '仍需支持']) }, { key: 'note', name: '复查事实和帮助', type: 'textarea' }, { key: 'nextDate', name: '下次复查日期', type: 'date', value: this.data.date }, { key: 'close', name: '本次结束跟进（不代表长期掌握）', type: 'switch', value: false }], { id: e.currentTarget.dataset.id }); },
    goal() { this.open('每周一个可观察目标', 'goalSave', [{ key: 'goal', name: '目标（如先找数量关系再列式）', type: 'textarea' }, { key: 'endDate', name: '本周结束日期', type: 'date', value: this.data.date }], { studentId: this.data.selectedId, date: this.data.date }); },
    handoff() { this.open('遗留事项交接', 'handoffSave', [{ key: 'issue', name: '什么未完成', type: 'textarea' }, { key: 'reason', name: '原因' }, { key: 'next', name: '下一步行动', type: 'textarea' }, { key: 'ownerId', name: '交接负责人', type: 'select', options: opt(this.data.dash.teachers) }, { key: 'dueDate', name: '处理期限', type: 'date', value: this.data.date }], { studentId: this.data.selectedId, date: this.data.date }); },
    handoffClose(e) { this.open('结束遗留事项', 'handoffClose', [{ key: 'result', name: '实际处理结果', type: 'textarea' }], { id: e.currentTarget.dataset.id }); },
    emotion() { this.open('状态记录（内部与家长说明分开）', 'emotionSave', [{ key: 'internal', name: '内部：观察事实、已采取支持及后续', type: 'textarea' }, { key: 'parentText', name: '供老师参考的家长说明（发布日报时手动确认）', type: 'textarea' }], { studentId: this.data.selectedId, date: this.data.date }); },
    progress() { const rs = this.data.detail.reviews.map((r) => ({ value: r.id, label: r.date + ' ' + r.result + ' ' + r.note })); this.open('具体进步（关联前后复查证据）', 'progressSave', [{ key: 'text', name: '具体变化', type: 'textarea' }, { key: 'beforeId', name: '之前的复查记录', type: 'select', options: rs }, { key: 'afterId', name: '之后的复查记录', type: 'select', options: rs }], { studentId: this.data.selectedId, date: this.data.date }); },
    async draft(e) { const weekly = e.currentTarget.dataset.kind === 'weekly'; const start = new Date(this.data.date + 'T00:00:00+08:00'); start.setDate(start.getDate() - 6); await this.submit('feedbackDraft', { studentId: this.data.selectedId, date: this.data.date, kind: weekly ? 'weekly' : 'daily', startDate: new Date(start.getTime() + 8 * 3600000).toISOString().slice(0, 10) }); },
    publishFeedback(e) { const f = this.data.detail.feedback.find((f) => f.id === e.currentTarget.dataset.id); this.open('主责老师确认发布', 'feedbackPublish', [{ key: 'text', name: '反馈正文（核对事实、状态说明和家庭配合）', type: 'textarea', value: f.text }], { id: f.id, version: f.version }); },
    async read(e) { await this.submit('feedbackRead', { id: e.currentTarget.dataset.id }); },
    communicate() { this.open('需要沟通', 'communicationCreate', [{ key: 'text', name: '希望主责老师跟进的问题', type: 'textarea' }], { studentId: this.data.selectedId }); },
    closeCommunication(e) { this.open('家长沟通处理结果', 'communicationClose', [{ key: 'result', name: '已采取的行动与结果', type: 'textarea' }], { id: e.currentTarget.dataset.id }); },
    async invite() { await this.submit('inviteCreate', { studentId: this.data.selectedId }); },
    async createInvite() { const r = await this.submit('inviteCreate', { studentId: this.data.selectedId }); if (r)
        wx.showModal({ title: '24小时有效邀请', content: r.code, confirmText: '复制', success: x => { if (x.confirm)
                wx.setClipboardData({ data: r.code }); } }); },
    claim() { this.open('申请绑定孩子（须机构核验）', 'inviteClaim', [{ key: 'code', name: '机构提供的邀请码' }, { key: 'relationship', name: '与孩子的关系' }, { key: 'phone', name: '联系电话' }]); },
    register() { this.open('设置我的称呼', 'register', [{ key: 'name', name: '姓名或称呼', value: this.data.session.user.name }]); },
    verify(e) { this.open('机构核验监护人', 'bindingVerify', [{ key: 'evidence', name: '线下核验依据（不要填写证件号码）', type: 'textarea' }, { key: 'approve', name: '核验通过并允许查看', type: 'switch', value: false }], { id: e.currentTarget.dataset.id }); },
    async revoke(e) { const r = await new Promise(resolve => wx.showModal({ title: '撤销绑定', content: '撤销后该家长无法再查看此学生，已下载的信息无法远程撤回。', success: r => resolve(r.confirm) })); if (r)
        await this.submit('bindingRevoke', { id: e.currentTarget.dataset.id }); },
    async contacts() { try {
        const rows = await (0, api_1.api)('contacts', { studentId: this.data.selectedId });
        if (!rows.length) {
            wx.showToast({ title: '暂无已核验监护人联系方式', icon: 'none' });
            return;
        }
        wx.showActionSheet({ itemList: rows.map((r) => r.relationship + ' ' + r.phone), success: r => wx.makePhoneCall({ phoneNumber: rows[r.tapIndex].phone }) });
    }
    catch (e) {
        this.setData({ error: e.message });
    } },
    async exportData() { try {
        const data = await (0, api_1.api)('export', { studentId: this.data.selectedId });
        const path = wx.env.USER_DATA_PATH + '/子墨学堂-' + Date.now() + '.json';
        wx.getFileSystemManager().writeFile({ filePath: path, data: JSON.stringify(data, null, 2), encoding: 'utf8', success: () => wx.shareFileMessage({ filePath: path, fileName: '子墨学堂学生记录.json', fail: () => wx.showModal({ title: '导出文件已生成', content: '文件位于小程序沙箱；请在支持文件分享的微信版本中重试。', showCancel: false }) }), fail: () => this.setData({ error: '导出文件写入失败' }) });
    }
    catch (e) {
        this.setData({ error: e.message });
    } },
    async upload() { if (!this.data.form || this.data.form.action !== 'mistakeSave')
        return; try {
        const r = await wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'] });
        const path = r.tempFiles[0].tempFilePath;
        const fs = wx.getFileSystemManager();
        const stat = fs.statSync(path);
        if (stat.size > 500000)
            throw new Error('图片超过500KB，请先压缩后重试');
        const base64 = fs.readFileSync(path, 'base64');
        const subject = this.data.form.fields.find((f) => f.key === 'subject').value;
        if (!subject)
            throw new Error('请先选择科目');
        this.setData({ saving: true });
        const result = await (0, api_1.api)('fileUpload', { studentId: this.data.selectedId, subject, base64 });
        const i = this.data.form.fields.findIndex((f) => f.key === 'fileId');
        this.setData({ [`form.fields[${i}].value`]: result.id });
    }
    catch (e) {
        this.setData({ formError: e.message });
    }
    finally {
        this.setData({ saving: false });
    } },
    async viewFile(e) { try {
        const r = await (0, api_1.api)('fileRead', { id: e.currentTarget.dataset.id });
        const path = wx.env.USER_DATA_PATH + '/zimo-' + Date.now() + '.jpg';
        wx.getFileSystemManager().writeFileSync(path, r.base64, 'base64');
        wx.previewImage({ urls: [path] });
    }
    catch (e) {
        this.setData({ error: e.message });
    } },
    adminAdd(e) {
        var _a;
        const table = e.currentTarget.dataset.table;
        const id = e.currentTarget.dataset.id;
        let record = {};
        if (id) {
            record = table === 'students' ? this.data.detail.student : ((_a = this.data.dash[table]) === null || _a === void 0 ? void 0 : _a.find((r) => r.id === id)) || {};
        }
        let fields = [];
        const d = this.data.dash;
        if (['schools', 'groups'].includes(table))
            fields = [{ key: 'name', name: '名称' }];
        if (table === 'classes')
            fields = [{ key: 'schoolId', name: '学校', type: 'select', options: opt(d.schools) }, { key: 'name', name: '规范班级名（如三年一班）' }, { key: 'grade', name: '年级（1至6）', type: 'number' }, { key: 'schoolYear', name: '学年起始年份', type: 'number', value: 2026 }];
        if (table === 'users')
            fields = [{ key: 'name', name: '员工姓名' }, { key: 'roles', name: '角色代码（逗号隔开：teacher,lead,admin,parent）' }, { key: 'enabled', name: '账号启用', type: 'switch', value: true }];
        if (table === 'students')
            fields = [{ key: 'number', name: '学生编号' }, { key: 'name', name: '学生姓名' }, { key: 'classId', name: '当前学校班级（含学年）', type: 'select', options: d.classes.map((c) => { var _a; return ({ value: c.id, label: c.schoolYear + ' ' + ((_a = d.schools.find((s) => s.id === c.schoolId)) === null || _a === void 0 ? void 0 : _a.name) + ' ' + c.name }); }) }, { key: 'groupId', name: '机构分组', type: 'select', options: opt(d.groups) }, { key: 'leadId', name: '主责老师', type: 'select', options: opt(d.teachers) }, ...['chinese', 'math', 'english'].map((key, i) => { var _a; return ({ key, name: subs[i] + '负责老师', type: 'select', options: opt(d.teachers), value: ((_a = record.assignments) === null || _a === void 0 ? void 0 : _a[subs[i]]) || '' }); }), { key: 'active', name: '在读', type: 'switch', value: true }];
        if (id)
            fields = fields.map(f => { var _a, _b, _c; return ({ ...f, value: f.key === 'roles' ? (_a = record.roles) === null || _a === void 0 ? void 0 : _a.join(',') : ((_c = (_b = record[f.key]) !== null && _b !== void 0 ? _b : f.value) !== null && _c !== void 0 ? _c : '') }); });
        this.open(id ? '编辑／升年级／转班' : '新增' + { schools: '学校', classes: '学校班级', groups: '机构分组', students: '学生', users: '员工' }[table], 'adminSave', fields, { table, ...(id ? { id } : {}) });
    },
    authorize() { this.open('授权已登录员工', 'adminSave', [{ key: 'name', name: '员工姓名' }, { key: 'roles', name: '角色（逗号隔开：teacher,lead,admin,parent）' }, { key: 'enabled', name: '启用', type: 'switch', value: true }, { key: 'accountId', name: '对方登录后页面显示的账号编号' }], { table: 'users' }); },
    scoreSubject(e) { this.setData({ subject: subs[Number(e.detail.value)], subjectIndex: Number(e.detail.value) }); this.updateScores(); },
    scoreFilter(e) { const index = Number(e.detail.value); this.setData({ scoreType: this.data.scoreTypes[index], scoreTypeIndex: index }); this.updateScores(); },
    scoreRange(e) { this.setData({ [e.currentTarget.dataset.key]: e.detail.value }); this.updateScores(); },
    updateScores() { if (!this.data.detail)
        return; const rows = this.data.detail.scores.filter((s) => s.subject === this.data.subject && (this.data.scoreType === '全部' || s.type === this.data.scoreType) && (!this.data.rangeStart || s.date >= this.data.rangeStart) && (!this.data.rangeEnd || s.date <= this.data.rangeEnd)).sort((a, b) => a.date.localeCompare(b.date)); this.setData({ scoreRows: rows }); setTimeout(() => this.drawChart(), 120); },
    drawChart() { if (this.data.tab !== 'scores' && !(!this.data.staff && this.data.tab === 'today'))
        return; const paint = (width) => { const ctx = wx.createCanvasContext('scoreChart', this); const rows = this.data.scoreRows; ctx.clearRect(0, 0, width, 210); ctx.setStrokeStyle('#cbd8d0'); ctx.setFontSize(10); ctx.setFillStyle('#64756c'); for (const n of [0, 25, 50, 75, 100]) {
        const y = 175 - n * 1.4;
        ctx.fillText(n + '%', 0, y + 3);
        ctx.moveTo(34, y);
        ctx.lineTo(width - 8, y);
    } ctx.stroke(); const points = rows.map((s, i) => ({ x: 40 + (rows.length > 1 ? i * (width - 60) / (rows.length - 1) : (width - 60) / 2), y: 175 - s.score / s.full * 140, id: s.id })); ctx.beginPath(); ctx.setStrokeStyle('#28785a'); points.forEach((p, i) => { if (i === 0)
        ctx.moveTo(p.x, p.y);
    else
        ctx.lineTo(p.x, p.y); }); ctx.stroke(); for (let i = 0; i < points.length; i++) {
        const p = points[i];
        ctx.beginPath();
        ctx.setFillStyle('#28785a');
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (i === 0 || i === points.length - 1)
            ctx.fillText(rows[i].date.slice(5), p.x - 15, 198);
    } ctx.draw(); this.setData({ chartPoints: points }); }; wx.createSelectorQuery().in(this).select('#scoreChart').boundingClientRect((r) => { if (r === null || r === void 0 ? void 0 : r.width)
        paint(r.width); }).exec(); },
    chartTap(e) { var _a, _b; const x = (_b = (_a = e.touches) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.x; if (x === undefined)
        return; const p = this.data.chartPoints.reduce((a, b) => !a || Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a, null); if (p)
        this.scoreDetail({ currentTarget: { dataset: { id: p.id } } }); },
    scoreDetail(e) { const s = this.data.scoreRows.find((s) => s.id === e.currentTarget.dataset.id); wx.showModal({ title: s.name, content: `${s.date} ${s.subject} ${s.type}\n原始分数 ${s.score} / ${s.full}\n范围：${s.scope || '未填写'}\n来源：${s.source}\n${s.verified ? '已核验' : '待核验'}\n备注：${s.note || '无'}`, showCancel: false }); }
});

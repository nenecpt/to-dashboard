/* ============================================
   TO 線控管理中心 — Application Logic
   行健旅遊 UNOTOUR Tour Operator Dashboard
   ============================================ */

// === Data Store ===
const STORAGE_KEY = 'to-dashboard-data';

const Store = {
    data: { lines: [], version: 1 },

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.data = JSON.parse(raw);
            }
        } catch (e) {
            console.error('Failed to load data:', e);
        }
        return this.data;
    },

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    },

    getLines() { return this.data.lines || []; },

    getLine(id) { return this.data.lines.find(l => l.id === id); },

    addLine(line) {
        line.id = 'line_' + Date.now();
        line.createdAt = new Date().toISOString().split('T')[0];
        line.updatedAt = line.createdAt;
        line.deadlines = line.deadlines || [];
        line.todos = line.todos || [];
        line.finances = line.finances || { revenuePerPerson: 0, costs: [] };
        this.data.lines.push(line);
        this.save();
        return line;
    },

    updateLine(id, updates) {
        const idx = this.data.lines.findIndex(l => l.id === id);
        if (idx === -1) return null;
        this.data.lines[idx] = { ...this.data.lines[idx], ...updates, updatedAt: new Date().toISOString().split('T')[0] };
        this.save();
        return this.data.lines[idx];
    },

    deleteLine(id) {
        this.data.lines = this.data.lines.filter(l => l.id !== id);
        this.save();
    },

    addDeadline(lineId, deadline) {
        const line = this.getLine(lineId);
        if (!line) return;
        deadline.id = 'dl_' + Date.now();
        deadline.done = false;
        line.deadlines.push(deadline);
        this.save();
    },

    toggleDeadline(lineId, deadlineId) {
        const line = this.getLine(lineId);
        if (!line) return;
        const dl = line.deadlines.find(d => d.id === deadlineId);
        if (dl) { dl.done = !dl.done; this.save(); }
    },

    deleteDeadline(lineId, deadlineId) {
        const line = this.getLine(lineId);
        if (!line) return;
        line.deadlines = line.deadlines.filter(d => d.id !== deadlineId);
        this.save();
    },

    addTodo(lineId, todo) {
        const line = this.getLine(lineId);
        if (!line) return;
        todo.id = 'todo_' + Date.now();
        todo.done = false;
        line.todos.push(todo);
        this.save();
    },

    toggleTodo(lineId, todoId) {
        const line = this.getLine(lineId);
        if (!line) return;
        const t = line.todos.find(td => td.id === todoId);
        if (t) { t.done = !t.done; this.save(); }
    },

    deleteTodo(lineId, todoId) {
        const line = this.getLine(lineId);
        if (!line) return;
        line.todos = line.todos.filter(t => t.id !== todoId);
        this.save();
    },

    addCost(lineId, cost) {
        const line = this.getLine(lineId);
        if (!line) return;
        cost.id = 'cost_' + Date.now();
        line.finances.costs.push(cost);
        this.save();
    },

    deleteCost(lineId, costId) {
        const line = this.getLine(lineId);
        if (!line) return;
        line.finances.costs = line.finances.costs.filter(c => c.id !== costId);
        this.save();
    },

    exportData() {
        return JSON.stringify(this.data, null, 2);
    },

    importData(json) {
        try {
            const parsed = JSON.parse(json);
            if (parsed.lines && Array.isArray(parsed.lines)) {
                this.data = parsed;
                this.save();
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }
};

// === Utilities ===
const Utils = {
    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return `${d.getMonth() + 1}/${d.getDate()}`;
    },

    formatDateFull(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    },

    daysUntil(dateStr) {
        if (!dateStr) return Infinity;
        const target = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    },

    urgencyClass(days) {
        if (days < 0) return 'overdue';
        if (days <= 3) return 'critical';
        if (days <= 7) return 'warning';
        if (days <= 14) return 'caution';
        return 'safe';
    },

    urgencyLabel(days) {
        if (days < 0) return `逾期 ${Math.abs(days)} 天`;
        if (days === 0) return '今天截止';
        if (days === 1) return '明天截止';
        return `${days} 天後`;
    },

    formatMoney(n) {
        if (n == null || isNaN(n)) return '$0';
        return '$' + Math.round(n).toLocaleString('zh-TW');
    },

    statusLabel(status) {
        const labels = {
            planning: '🟢 規劃中',
            confirmed: '🔵 已確認',
            departing: '🟡 即將出團',
            active: '🟣 出團中',
            completed: '✅ 已完成'
        };
        return labels[status] || status;
    },

    statusColor(status) {
        const colors = {
            planning: '#34d399',
            confirmed: '#60a5fa',
            departing: '#fbbf24',
            active: '#a78bfa',
            completed: '#6b7280'
        };
        return colors[status] || '#6b7280';
    },

    priorityLabel(p) {
        return { high: '高', medium: '中', low: '低' }[p] || p;
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
};

// === Router ===
const Router = {
    currentView: 'dashboard',
    currentLineId: null,

    init() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(hash);
    },

    navigate(view, lineId) {
        // Special case for line detail
        if (view === 'line-detail' && lineId) {
            this.currentView = 'line-detail';
            this.currentLineId = lineId;
        } else {
            this.currentView = view;
            this.currentLineId = null;
        }

        // Update URL hash (don't set for line-detail to avoid confusion)
        if (view !== 'line-detail') {
            window.location.hash = view;
        }

        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        // Show target view
        const targetViewId = view === 'line-detail' ? 'view-line-detail' : `view-${view}`;
        const targetView = document.getElementById(targetViewId);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Update nav links
        document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(link => {
            link.classList.toggle('active', link.dataset.view === view);
        });

        // Update page title
        const titles = {
            dashboard: '總覽',
            lines: '線路管理',
            'line-detail': '線路詳情',
            todos: '待辦事項',
            finance: '收支管理'
        };
        document.getElementById('page-title').textContent = titles[view] || '總覽';

        // Render the view
        this.renderCurrentView();
    },

    renderCurrentView() {
        switch (this.currentView) {
            case 'dashboard': Dashboard.render(); break;
            case 'lines': Lines.render(); break;
            case 'line-detail': LineDetail.render(this.currentLineId); break;
            case 'todos': Todos.render(); break;
            case 'finance': Finance.render(); break;
        }
    }
};

// === Dashboard Module ===
const Dashboard = {
    render() {
        const lines = Store.getLines();
        this.renderStats(lines);
        this.renderUrgentDeadlines(lines);
        this.renderLinesGrid(lines);
    },

    renderStats(lines) {
        // Total lines
        document.getElementById('stat-total-lines').textContent = lines.length;

        // Urgent deadlines (within 7 days)
        let urgentCount = 0;
        lines.forEach(line => {
            line.deadlines.forEach(dl => {
                if (!dl.done && Utils.daysUntil(dl.date) <= 7) urgentCount++;
            });
        });
        document.getElementById('stat-urgent-deadlines').textContent = urgentCount;

        // Todo completion rate
        let totalTodos = 0, doneTodos = 0;
        lines.forEach(line => {
            totalTodos += line.todos.length;
            doneTodos += line.todos.filter(t => t.done).length;
        });
        const rate = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;
        document.getElementById('stat-todo-rate').textContent = rate + '%';

        // Total revenue estimate
        let totalRevenue = 0;
        lines.forEach(line => {
            const bookings = line.currentBookings || 0;
            const rpp = line.finances?.revenuePerPerson || 0;
            totalRevenue += bookings * rpp;
        });
        document.getElementById('stat-total-revenue').textContent = Utils.formatMoney(totalRevenue);
    },

    renderUrgentDeadlines(lines) {
        const section = document.getElementById('urgent-section');
        const list = document.getElementById('urgent-deadline-list');

        // Collect all urgent deadlines across lines
        const urgentDeadlines = [];
        lines.forEach(line => {
            line.deadlines.forEach(dl => {
                if (dl.done) return;
                const days = Utils.daysUntil(dl.date);
                if (days <= 14) {
                    urgentDeadlines.push({ ...dl, lineName: line.name, lineId: line.id, days });
                }
            });
        });

        if (urgentDeadlines.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        urgentDeadlines.sort((a, b) => a.days - b.days);

        list.innerHTML = urgentDeadlines.map(dl => `
            <div class="deadline-item" onclick="Router.navigate('line-detail', '${dl.lineId}')">
                <div class="deadline-item-left">
                    <span class="deadline-pill ${Utils.urgencyClass(dl.days)}">
                        ${Utils.urgencyLabel(dl.days)}
                    </span>
                    <div class="deadline-item-info">
                        <div class="deadline-item-label">${Utils.escapeHtml(dl.label)}</div>
                        <div class="deadline-item-line">${Utils.escapeHtml(dl.lineName)} · ${Utils.formatDateFull(dl.date)}</div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderLinesGrid(lines) {
        const grid = document.getElementById('dashboard-lines-grid');

        if (lines.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1">
                    <div class="empty-state-icon">✈️</div>
                    <div class="empty-state-text">還沒有任何線路</div>
                    <button class="btn-primary" onclick="Modals.openLineModal()">
                        <i data-lucide="plus"></i> 新增第一條線路
                    </button>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        grid.innerHTML = lines.map(line => {
            const bookingPct = line.capacity > 0 ? Math.round((line.currentBookings / line.capacity) * 100) : 0;
            const nextDeadline = line.deadlines
                .filter(d => !d.done)
                .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
            const pendingTodos = line.todos.filter(t => !t.done).length;

            let deadlineHtml = '';
            if (nextDeadline) {
                const days = Utils.daysUntil(nextDeadline.date);
                deadlineHtml = `
                    <div class="line-card-row">
                        <span><i data-lucide="alarm-clock"></i> ${Utils.escapeHtml(nextDeadline.label)}</span>
                        <span class="deadline-pill ${Utils.urgencyClass(days)}">${Utils.urgencyLabel(days)}</span>
                    </div>
                `;
            }

            return `
                <div class="line-card" style="--card-status-color: ${Utils.statusColor(line.status)}" 
                     onclick="Router.navigate('line-detail', '${line.id}')">
                    <div class="line-card-header">
                        <div class="line-card-name">${Utils.escapeHtml(line.name)}</div>
                        ${line.region ? `<span class="line-card-region">${Utils.escapeHtml(line.region)}</span>` : ''}
                    </div>
                    <div class="line-card-body">
                        <div class="line-card-row">
                            <span class="status-badge ${line.status}">${Utils.statusLabel(line.status)}</span>
                            <span><i data-lucide="users"></i> ${line.currentBookings}/${line.capacity}</span>
                        </div>
                        <div class="booking-progress">
                            <div class="booking-progress-bar" style="width: ${bookingPct}%"></div>
                        </div>
                        ${line.departureDate ? `
                            <div class="line-card-row">
                                <span><i data-lucide="calendar"></i> ${Utils.formatDate(line.departureDate)} — ${Utils.formatDate(line.returnDate)}</span>
                            </div>
                        ` : ''}
                        ${deadlineHtml}
                        ${pendingTodos > 0 ? `
                            <div class="line-card-row">
                                <span><i data-lucide="check-square"></i> 待辦 ${pendingTodos} 項</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    }
};

// === Lines Module ===
const Lines = {
    render() {
        const lines = Store.getLines();
        const statusFilter = document.getElementById('filter-status').value;
        const regionFilter = document.getElementById('filter-region').value;

        // Update region filter options
        this.updateRegionFilter(lines);

        // Apply filters
        let filtered = lines;
        if (statusFilter !== 'all') {
            filtered = filtered.filter(l => l.status === statusFilter);
        }
        if (regionFilter !== 'all') {
            filtered = filtered.filter(l => l.region === regionFilter);
        }

        const list = document.getElementById('lines-list');

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🗺️</div>
                    <div class="empty-state-text">${lines.length === 0 ? '還沒有任何線路' : '沒有符合篩選條件的線路'}</div>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(line => {
            const pendingTodos = line.todos.filter(t => !t.done).length;
            const pendingDeadlines = line.deadlines.filter(d => !d.done).length;

            return `
                <div class="line-list-item" onclick="Router.navigate('line-detail', '${line.id}')">
                    <div class="line-list-info">
                        <div class="line-list-name">${Utils.escapeHtml(line.name)}</div>
                        <div class="line-list-dates">
                            ${line.departureDate ? Utils.formatDateFull(line.departureDate) : '未排定'} 
                            ${line.region ? `· ${Utils.escapeHtml(line.region)}` : ''}
                        </div>
                    </div>
                    <span class="status-badge ${line.status}">${Utils.statusLabel(line.status)}</span>
                    <span class="line-list-bookings">${line.currentBookings}/${line.capacity} 人</span>
                    <div class="line-list-actions" onclick="event.stopPropagation()">
                        <button class="btn-icon" onclick="Modals.openLineModal('${line.id}')" title="編輯">
                            <i data-lucide="edit-2"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    },

    updateRegionFilter(lines) {
        const select = document.getElementById('filter-region');
        const currentVal = select.value;
        const regions = [...new Set(lines.map(l => l.region).filter(Boolean))].sort();

        select.innerHTML = '<option value="all">全部區域</option>' +
            regions.map(r => `<option value="${Utils.escapeHtml(r)}">${Utils.escapeHtml(r)}</option>`).join('');

        select.value = currentVal;
    }
};

// === Line Detail Module ===
const LineDetail = {
    render(lineId) {
        const line = Store.getLine(lineId);
        if (!line) {
            Router.navigate('lines');
            return;
        }

        const container = document.getElementById('line-detail-content');
        const bookingPct = line.capacity > 0 ? Math.round((line.currentBookings / line.capacity) * 100) : 0;

        // Calculate finances
        const revenue = (line.currentBookings || 0) * (line.finances?.revenuePerPerson || 0);
        let totalCost = 0;
        (line.finances?.costs || []).forEach(c => {
            totalCost += c.perPerson ? (c.amount * (line.currentBookings || 0)) : c.amount;
        });
        const profit = revenue - totalCost;

        container.innerHTML = `
            <!-- Header -->
            <div class="line-detail-header">
                <div>
                    <h2 class="line-detail-title">${Utils.escapeHtml(line.name)}</h2>
                    <div class="line-detail-meta">
                        <span class="status-badge ${line.status}">${Utils.statusLabel(line.status)}</span>
                        ${line.region ? `<span class="line-card-region">${Utils.escapeHtml(line.region)}</span>` : ''}
                    </div>
                </div>
                <div class="line-detail-actions">
                    <button class="btn-secondary" onclick="Modals.openLineModal('${line.id}')">
                        <i data-lucide="edit-2"></i> 編輯
                    </button>
                    <button class="btn-danger" onclick="LineDetail.confirmDelete('${line.id}')">
                        <i data-lucide="trash-2"></i> 刪除
                    </button>
                </div>
            </div>

            <!-- 基本資訊 -->
            <div class="detail-section">
                <div class="detail-section-title"><i data-lucide="info"></i> 基本資訊</div>
                <div class="detail-grid">
                    <div class="detail-field">
                        <span class="detail-field-label">出發日期</span>
                        <span class="detail-field-value">${Utils.formatDateFull(line.departureDate)}</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">回程日期</span>
                        <span class="detail-field-value">${Utils.formatDateFull(line.returnDate)}</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">報名 / 團位</span>
                        <span class="detail-field-value">${line.currentBookings} / ${line.capacity} 人 (${bookingPct}%)</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">每人團費</span>
                        <span class="detail-field-value">${Utils.formatMoney(line.finances?.revenuePerPerson)}</span>
                    </div>
                </div>
                <div class="booking-progress" style="margin-top: var(--space-4)">
                    <div class="booking-progress-bar" style="width: ${bookingPct}%"></div>
                </div>
                ${line.notes ? `<div class="detail-notes">${Utils.escapeHtml(line.notes)}</div>` : ''}
            </div>

            <!-- 截止日 -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <span><i data-lucide="alarm-clock"></i> 截止日管理</span>
                    <button class="btn-primary btn-sm" onclick="Modals.openDeadlineModal('${line.id}')">
                        <i data-lucide="plus"></i> 新增
                    </button>
                </div>
                ${line.deadlines.length === 0 ? '<div style="color: var(--text-muted); font-size: var(--font-size-sm);">尚無截止日</div>' :
                    '<div class="deadline-list">' + line.deadlines
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .map(dl => {
                            const days = Utils.daysUntil(dl.date);
                            return `
                                <div class="deadline-item ${dl.done ? 'done' : ''}">
                                    <div class="deadline-item-left">
                                        <div class="todo-checkbox ${dl.done ? 'checked' : ''}" 
                                             onclick="LineDetail.toggleDeadline('${line.id}', '${dl.id}')"></div>
                                        <div class="deadline-item-info">
                                            <div class="deadline-item-label" style="${dl.done ? 'text-decoration: line-through; opacity: 0.5' : ''}">${Utils.escapeHtml(dl.label)}</div>
                                            <div class="deadline-item-line">${Utils.formatDateFull(dl.date)}</div>
                                        </div>
                                    </div>
                                    ${!dl.done ? `<span class="deadline-pill ${Utils.urgencyClass(days)}">${Utils.urgencyLabel(days)}</span>` : ''}
                                    <button class="btn-icon todo-delete" onclick="LineDetail.deleteDeadline('${line.id}', '${dl.id}')" 
                                            style="opacity: 0.5" title="刪除">
                                        <i data-lucide="x"></i>
                                    </button>
                                </div>
                            `;
                        }).join('') + '</div>'
                }
            </div>

            <!-- 待辦事項 -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <span><i data-lucide="check-square"></i> 待辦事項</span>
                    <button class="btn-primary btn-sm" onclick="Modals.openTodoModal('${line.id}')">
                        <i data-lucide="plus"></i> 新增
                    </button>
                </div>
                ${line.todos.length === 0 ? '<div style="color: var(--text-muted); font-size: var(--font-size-sm);">尚無待辦事項</div>' :
                    '<div class="todos-list">' + line.todos
                        .sort((a, b) => {
                            if (a.done !== b.done) return a.done ? 1 : -1;
                            const pOrder = { high: 0, medium: 1, low: 2 };
                            return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
                        })
                        .map(todo => `
                            <div class="todo-item ${todo.done ? 'done' : ''}">
                                <div class="todo-checkbox ${todo.done ? 'checked' : ''}" 
                                     onclick="LineDetail.toggleTodo('${line.id}', '${todo.id}')"></div>
                                <span class="priority-dot ${todo.priority}"></span>
                                <div class="todo-content">
                                    <div class="todo-text">${Utils.escapeHtml(todo.text)}</div>
                                    <div class="todo-meta">
                                        ${todo.dueDate ? `<span>${Utils.formatDateFull(todo.dueDate)}</span>` : ''}
                                    </div>
                                </div>
                                <button class="btn-icon todo-delete" onclick="LineDetail.deleteTodo('${line.id}', '${todo.id}')" title="刪除">
                                    <i data-lucide="x"></i>
                                </button>
                            </div>
                        `).join('') + '</div>'
                }
            </div>

            <!-- 收支 -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <span><i data-lucide="wallet"></i> 收支明細</span>
                    <button class="btn-primary btn-sm" onclick="Modals.openCostModal('${line.id}')">
                        <i data-lucide="plus"></i> 新增成本
                    </button>
                </div>
                <div class="detail-grid" style="margin-bottom: var(--space-4)">
                    <div class="detail-field">
                        <span class="detail-field-label">預估總收入</span>
                        <span class="detail-field-value" style="color: var(--accent-blue)">${Utils.formatMoney(revenue)}</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">總成本</span>
                        <span class="detail-field-value" style="color: var(--urgent-warning)">${Utils.formatMoney(totalCost)}</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">利潤</span>
                        <span class="detail-field-value ${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${Utils.formatMoney(profit)}</span>
                    </div>
                </div>
                ${(line.finances?.costs || []).length > 0 ? `
                    <div class="todos-list">
                        ${line.finances.costs.map(c => `
                            <div class="todo-item">
                                <div class="todo-content">
                                    <div class="todo-text">${Utils.escapeHtml(c.item)}</div>
                                    <div class="todo-meta">${c.perPerson ? '每人費用' : '固定費用'}</div>
                                </div>
                                <span style="font-weight: 600; color: var(--urgent-warning); white-space: nowrap">
                                    ${Utils.formatMoney(c.perPerson ? c.amount * (line.currentBookings || 0) : c.amount)}
                                    ${c.perPerson ? `<span style="font-size: var(--font-size-xs); color: var(--text-muted)"> (${Utils.formatMoney(c.amount)}/人)</span>` : ''}
                                </span>
                                <button class="btn-icon todo-delete" onclick="LineDetail.deleteCost('${line.id}', '${c.id}')" title="刪除">
                                    <i data-lucide="x"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div style="color: var(--text-muted); font-size: var(--font-size-sm);">尚無成本項目</div>'}
            </div>
        `;

        lucide.createIcons();
    },

    toggleDeadline(lineId, dlId) {
        Store.toggleDeadline(lineId, dlId);
        this.render(lineId);
    },

    deleteDeadline(lineId, dlId) {
        if (confirm('確定刪除此截止日？')) {
            Store.deleteDeadline(lineId, dlId);
            this.render(lineId);
        }
    },

    toggleTodo(lineId, todoId) {
        Store.toggleTodo(lineId, todoId);
        this.render(lineId);
    },

    deleteTodo(lineId, todoId) {
        if (confirm('確定刪除此待辦？')) {
            Store.deleteTodo(lineId, todoId);
            this.render(lineId);
        }
    },

    deleteCost(lineId, costId) {
        if (confirm('確定刪除此成本項目？')) {
            Store.deleteCost(lineId, costId);
            this.render(lineId);
        }
    },

    confirmDelete(lineId) {
        const line = Store.getLine(lineId);
        if (line && confirm(`確定要刪除線路「${line.name}」嗎？\n此操作無法復原！`)) {
            Store.deleteLine(lineId);
            Router.navigate('lines');
        }
    }
};

// === Todos Module (Cross-line aggregate) ===
const Todos = {
    render() {
        const lines = Store.getLines();
        const priorityFilter = document.getElementById('filter-todo-priority').value;
        const hideDone = document.getElementById('filter-hide-done').checked;

        // Collect all todos across lines
        let allTodos = [];
        lines.forEach(line => {
            line.todos.forEach(todo => {
                allTodos.push({ ...todo, lineName: line.name, lineId: line.id });
            });
        });

        // Apply filters
        if (priorityFilter !== 'all') {
            allTodos = allTodos.filter(t => t.priority === priorityFilter);
        }
        if (hideDone) {
            allTodos = allTodos.filter(t => !t.done);
        }

        // Sort: undone first, then by priority, then by due date
        allTodos.sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            const pOrder = { high: 0, medium: 1, low: 2 };
            if (pOrder[a.priority] !== pOrder[b.priority]) return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
            if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });

        const list = document.getElementById('todos-list');

        if (allTodos.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div class="empty-state-text">${lines.length === 0 ? '先新增線路再建立待辦' : '沒有待辦事項'}</div>
                </div>
            `;
            return;
        }

        list.innerHTML = allTodos.map(todo => {
            let duePill = '';
            if (todo.dueDate && !todo.done) {
                const days = Utils.daysUntil(todo.dueDate);
                duePill = `<span class="deadline-pill ${Utils.urgencyClass(days)}">${Utils.urgencyLabel(days)}</span>`;
            }
            return `
                <div class="todo-item ${todo.done ? 'done' : ''}">
                    <div class="todo-checkbox ${todo.done ? 'checked' : ''}" 
                         onclick="Todos.toggle('${todo.lineId}', '${todo.id}')"></div>
                    <span class="priority-dot ${todo.priority}"></span>
                    <div class="todo-content">
                        <div class="todo-text">${Utils.escapeHtml(todo.text)}</div>
                        <div class="todo-meta">
                            <span style="color: var(--accent-blue)">${Utils.escapeHtml(todo.lineName)}</span>
                            ${todo.dueDate ? ` · ${Utils.formatDateFull(todo.dueDate)}` : ''}
                        </div>
                    </div>
                    ${duePill}
                    <button class="btn-icon todo-delete" onclick="Todos.delete('${todo.lineId}', '${todo.id}')" title="刪除">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    },

    toggle(lineId, todoId) {
        Store.toggleTodo(lineId, todoId);
        this.render();
    },

    delete(lineId, todoId) {
        if (confirm('確定刪除此待辦？')) {
            Store.deleteTodo(lineId, todoId);
            this.render();
        }
    }
};

// === Finance Module ===
const Finance = {
    render() {
        const lines = Store.getLines();
        this.renderSummary(lines);
        this.renderTable(lines);
    },

    renderSummary(lines) {
        let totalRevenue = 0, totalCost = 0;

        lines.forEach(line => {
            const bookings = line.currentBookings || 0;
            const rpp = line.finances?.revenuePerPerson || 0;
            totalRevenue += bookings * rpp;

            (line.finances?.costs || []).forEach(c => {
                totalCost += c.perPerson ? (c.amount * bookings) : c.amount;
            });
        });

        const totalProfit = totalRevenue - totalCost;

        document.getElementById('finance-summary').innerHTML = `
            <div class="finance-card">
                <div class="finance-card-value revenue">${Utils.formatMoney(totalRevenue)}</div>
                <div class="finance-card-label">預估總收入</div>
            </div>
            <div class="finance-card">
                <div class="finance-card-value cost">${Utils.formatMoney(totalCost)}</div>
                <div class="finance-card-label">總成本</div>
            </div>
            <div class="finance-card">
                <div class="finance-card-value ${totalProfit >= 0 ? 'profit' : 'loss'}">${Utils.formatMoney(totalProfit)}</div>
                <div class="finance-card-label">總利潤</div>
            </div>
        `;
    },

    renderTable(lines) {
        const tbody = document.getElementById('finance-table-body');
        const tfoot = document.getElementById('finance-table-foot');

        if (lines.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: var(--space-8)">尚無線路資料</td></tr>';
            tfoot.innerHTML = '';
            return;
        }

        let grandRevenue = 0, grandCost = 0;

        tbody.innerHTML = lines.map(line => {
            const bookings = line.currentBookings || 0;
            const rpp = line.finances?.revenuePerPerson || 0;
            const revenue = bookings * rpp;
            let cost = 0;
            (line.finances?.costs || []).forEach(c => {
                cost += c.perPerson ? (c.amount * bookings) : c.amount;
            });
            const profit = revenue - cost;
            const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '—';

            grandRevenue += revenue;
            grandCost += cost;

            return `
                <tr onclick="Router.navigate('line-detail', '${line.id}')">
                    <td><strong>${Utils.escapeHtml(line.name)}</strong></td>
                    <td>${bookings}/${line.capacity}</td>
                    <td style="color: var(--accent-blue)">${Utils.formatMoney(revenue)}</td>
                    <td style="color: var(--urgent-warning)">${Utils.formatMoney(cost)}</td>
                    <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${Utils.formatMoney(profit)}</td>
                    <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${margin}%</td>
                </tr>
            `;
        }).join('');

        const grandProfit = grandRevenue - grandCost;
        const grandMargin = grandRevenue > 0 ? ((grandProfit / grandRevenue) * 100).toFixed(1) : '—';

        tfoot.innerHTML = `
            <tr>
                <td>合計</td>
                <td></td>
                <td style="color: var(--accent-blue)">${Utils.formatMoney(grandRevenue)}</td>
                <td style="color: var(--urgent-warning)">${Utils.formatMoney(grandCost)}</td>
                <td class="${grandProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${Utils.formatMoney(grandProfit)}</td>
                <td class="${grandProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${grandMargin}%</td>
            </tr>
        `;
    }
};

// === Modals ===
const Modals = {
    open(id) {
        document.getElementById(id).classList.add('active');
    },

    close(id) {
        document.getElementById(id).classList.remove('active');
    },

    openLineModal(lineId) {
        const isEdit = !!lineId;
        document.getElementById('modal-line-title').textContent = isEdit ? '編輯線路' : '新增線路';

        if (isEdit) {
            const line = Store.getLine(lineId);
            if (!line) return;
            document.getElementById('line-id').value = line.id;
            document.getElementById('line-name').value = line.name;
            document.getElementById('line-region').value = line.region || '';
            document.getElementById('line-status').value = line.status;
            document.getElementById('line-capacity').value = line.capacity;
            document.getElementById('line-departure').value = line.departureDate || '';
            document.getElementById('line-return').value = line.returnDate || '';
            document.getElementById('line-bookings').value = line.currentBookings;
            document.getElementById('line-revenue-pp').value = line.finances?.revenuePerPerson || 0;
            document.getElementById('line-notes').value = line.notes || '';
        } else {
            document.getElementById('form-line').reset();
            document.getElementById('line-id').value = '';
            document.getElementById('line-capacity').value = 16;
            document.getElementById('line-bookings').value = 0;
            document.getElementById('line-revenue-pp').value = 0;
        }

        this.open('modal-line');
    },

    openDeadlineModal(lineId) {
        document.getElementById('form-deadline').reset();
        document.getElementById('deadline-line-id').value = lineId;
        this.open('modal-deadline');
    },

    openTodoModal(lineId) {
        document.getElementById('form-todo').reset();

        // Populate line select
        const select = document.getElementById('todo-line-select');
        const lines = Store.getLines();
        select.innerHTML = lines.map(l =>
            `<option value="${l.id}" ${l.id === lineId ? 'selected' : ''}>${Utils.escapeHtml(l.name)}</option>`
        ).join('');

        if (lineId) {
            document.getElementById('todo-line-id').value = lineId;
        }

        this.open('modal-todo');
    },

    openCostModal(lineId) {
        document.getElementById('form-cost').reset();
        document.getElementById('cost-line-id').value = lineId;
        this.open('modal-cost');
    }
};

// === Search ===
const Search = {
    query: '',

    search(q) {
        this.query = q.trim().toLowerCase();
        const dropdown = document.getElementById('search-results');

        if (!this.query) {
            dropdown.style.display = 'none';
            return;
        }

        const lines = Store.getLines();
        const results = [];

        lines.forEach(line => {
            // Match line name
            if (line.name.toLowerCase().includes(this.query) || (line.region || '').toLowerCase().includes(this.query)) {
                results.push({ type: '線路', title: line.name, action: () => Router.navigate('line-detail', line.id) });
            }

            // Match todos
            line.todos.forEach(todo => {
                if (todo.text.toLowerCase().includes(this.query)) {
                    results.push({ type: `待辦 · ${line.name}`, title: todo.text, action: () => Router.navigate('line-detail', line.id) });
                }
            });

            // Match deadlines
            line.deadlines.forEach(dl => {
                if (dl.label.toLowerCase().includes(this.query)) {
                    results.push({ type: `截止日 · ${line.name}`, title: dl.label, action: () => Router.navigate('line-detail', line.id) });
                }
            });
        });

        if (results.length === 0) {
            dropdown.innerHTML = '<div class="search-result-item"><div class="search-result-title" style="color: var(--text-muted)">找不到結果</div></div>';
        } else {
            dropdown.innerHTML = results.slice(0, 10).map((r, i) => `
                <div class="search-result-item" onclick="Search.select(${i})">
                    <div class="search-result-title">${Utils.escapeHtml(r.title)}</div>
                    <div class="search-result-type">${Utils.escapeHtml(r.type)}</div>
                </div>
            `).join('');
        }

        dropdown.style.display = 'block';
        this._results = results;
    },

    select(idx) {
        if (this._results && this._results[idx]) {
            this._results[idx].action();
            document.getElementById('search-results').style.display = 'none';
            document.getElementById('global-search').value = '';
        }
    },

    hide() {
        setTimeout(() => {
            document.getElementById('search-results').style.display = 'none';
        }, 200);
    }
};

// === Event Listeners ===
function initEventListeners() {
    // Navigation links
    document.querySelectorAll('[data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            Router.navigate(view);

            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
        });
    });

    // Mobile menu toggle
    document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('mobile-menu-toggle');
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    // Add line button
    document.getElementById('btn-add-line').addEventListener('click', () => Modals.openLineModal());

    // Save line
    document.getElementById('btn-save-line').addEventListener('click', () => {
        const name = document.getElementById('line-name').value.trim();
        if (!name) { alert('請輸入線路名稱'); return; }

        const id = document.getElementById('line-id').value;
        const lineData = {
            name,
            region: document.getElementById('line-region').value.trim(),
            status: document.getElementById('line-status').value,
            capacity: parseInt(document.getElementById('line-capacity').value) || 16,
            departureDate: document.getElementById('line-departure').value,
            returnDate: document.getElementById('line-return').value,
            currentBookings: parseInt(document.getElementById('line-bookings').value) || 0,
            notes: document.getElementById('line-notes').value.trim()
        };

        if (id) {
            // Also update revenue per person
            const line = Store.getLine(id);
            if (line) {
                line.finances = line.finances || { revenuePerPerson: 0, costs: [] };
                line.finances.revenuePerPerson = parseInt(document.getElementById('line-revenue-pp').value) || 0;
            }
            Store.updateLine(id, lineData);
        } else {
            const newLine = Store.addLine(lineData);
            const line = Store.getLine(newLine.id);
            if (line) {
                line.finances.revenuePerPerson = parseInt(document.getElementById('line-revenue-pp').value) || 0;
                Store.save();
            }
        }

        Modals.close('modal-line');
        Router.renderCurrentView();
    });

    // Save deadline
    document.getElementById('btn-save-deadline').addEventListener('click', () => {
        const label = document.getElementById('deadline-label').value.trim();
        const date = document.getElementById('deadline-date').value;
        if (!label || !date) { alert('請填寫完整資訊'); return; }

        const lineId = document.getElementById('deadline-line-id').value;
        Store.addDeadline(lineId, { label, date });
        Modals.close('modal-deadline');
        Router.renderCurrentView();
    });

    // Save todo
    document.getElementById('btn-save-todo').addEventListener('click', () => {
        const text = document.getElementById('todo-text').value.trim();
        if (!text) { alert('請輸入待辦內容'); return; }

        const lineId = document.getElementById('todo-line-select').value || document.getElementById('todo-line-id').value;
        if (!lineId) { alert('請選擇線路'); return; }

        Store.addTodo(lineId, {
            text,
            priority: document.getElementById('todo-priority').value,
            dueDate: document.getElementById('todo-due').value || null
        });

        Modals.close('modal-todo');
        Router.renderCurrentView();
    });

    // Save cost
    document.getElementById('btn-save-cost').addEventListener('click', () => {
        const item = document.getElementById('cost-item').value.trim();
        const amount = parseInt(document.getElementById('cost-amount').value);
        if (!item || isNaN(amount)) { alert('請填寫完整資訊'); return; }

        const lineId = document.getElementById('cost-line-id').value;
        Store.addCost(lineId, {
            item,
            amount,
            perPerson: document.getElementById('cost-per-person').checked
        });

        Modals.close('modal-cost');
        Router.renderCurrentView();
    });

    // Add todo from global button
    document.getElementById('btn-add-todo-global').addEventListener('click', () => {
        Modals.openTodoModal();
    });

    // Back to lines
    document.getElementById('btn-back-to-lines').addEventListener('click', () => {
        Router.navigate('lines');
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            if (modalId) Modals.close(modalId);
        });
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    // Filters
    document.getElementById('filter-status').addEventListener('change', () => Lines.render());
    document.getElementById('filter-region').addEventListener('change', () => Lines.render());
    document.getElementById('filter-todo-priority').addEventListener('change', () => Todos.render());
    document.getElementById('filter-hide-done').addEventListener('change', () => Todos.render());

    // Search
    const searchInput = document.getElementById('global-search');
    searchInput.addEventListener('input', (e) => Search.search(e.target.value));
    searchInput.addEventListener('blur', () => Search.hide());

    // Export
    document.getElementById('btn-export').addEventListener('click', () => {
        const data = Store.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `to-dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Import
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (confirm('匯入將覆蓋現有資料，確定要繼續嗎？')) {
                if (Store.importData(event.target.result)) {
                    alert('匯入成功！');
                    Router.renderCurrentView();
                } else {
                    alert('匯入失敗：檔案格式不正確');
                }
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    });

    // Hash change
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        if (['dashboard', 'lines', 'todos', 'finance'].includes(hash)) {
            Router.navigate(hash);
        }
    });

    // Keyboard shortcut: Escape to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            document.getElementById('search-results').style.display = 'none';
        }
    });
}

// === Seed Demo Data (first-time only) ===
function seedDemoData() {
    if (Store.getLines().length > 0) return;

    const demoLines = [
        {
            name: '北歐五國極光 14 天',
            region: '北歐',
            status: 'confirmed',
            capacity: 16,
            currentBookings: 12,
            departureDate: '2026-05-15',
            returnDate: '2026-05-28',
            notes: '極光季末班，需準備備案室內活動方案',
            deadlines: [
                { id: 'dl_1', label: '機位確認截止', date: '2026-04-01', done: false },
                { id: 'dl_2', label: '飯店訂房截止', date: '2026-04-10', done: false },
                { id: 'dl_3', label: '簽證送件截止', date: '2026-04-20', done: false }
            ],
            todos: [
                { id: 'td_1', text: '確認赫爾辛基飯店房型', priority: 'high', done: false, dueDate: '2026-04-01' },
                { id: 'td_2', text: '聯繫極光拍攝攝影師', priority: 'medium', done: false, dueDate: '2026-04-15' },
                { id: 'td_3', text: '更新行程手冊 v3', priority: 'low', done: true, dueDate: null }
            ],
            finances: {
                revenuePerPerson: 189000,
                costs: [
                    { id: 'c_1', item: '機票', amount: 42000, perPerson: true },
                    { id: 'c_2', item: '飯店 (全程)', amount: 520000, perPerson: false },
                    { id: 'c_3', item: '地接社費用', amount: 380000, perPerson: false },
                    { id: 'c_4', item: '保險', amount: 2800, perPerson: true }
                ]
            }
        },
        {
            name: '西班牙葡萄牙 12 天',
            region: '西歐',
            status: 'planning',
            capacity: 20,
            currentBookings: 6,
            departureDate: '2026-06-10',
            returnDate: '2026-06-21',
            notes: '搭配佛朗明哥表演，需預訂餐廳',
            deadlines: [
                { id: 'dl_4', label: '航班確認', date: '2026-05-01', done: false }
            ],
            todos: [
                { id: 'td_4', text: '洽談馬德里地接社', priority: 'high', done: false, dueDate: '2026-04-10' },
                { id: 'td_5', text: '確認巴塞隆納聖家堂門票', priority: 'medium', done: false, dueDate: '2026-04-20' }
            ],
            finances: {
                revenuePerPerson: 135000,
                costs: [
                    { id: 'c_5', item: '機票', amount: 38000, perPerson: true },
                    { id: 'c_6', item: '飯店', amount: 420000, perPerson: false }
                ]
            }
        },
        {
            name: '東歐波蘭捷克 10 天',
            region: '東歐',
            status: 'departing',
            capacity: 16,
            currentBookings: 15,
            departureDate: '2026-03-25',
            returnDate: '2026-04-03',
            notes: '即將出發，確認最終名單',
            deadlines: [
                { id: 'dl_5', label: '最終名單確認', date: '2026-03-20', done: false },
                { id: 'dl_6', label: '行前說明會', date: '2026-03-22', done: false }
            ],
            todos: [
                { id: 'td_6', text: '列印團員資料', priority: 'high', done: false, dueDate: '2026-03-19' },
                { id: 'td_7', text: '確認遊覽車座位安排', priority: 'medium', done: false, dueDate: '2026-03-20' }
            ],
            finances: {
                revenuePerPerson: 98000,
                costs: [
                    { id: 'c_7', item: '機票', amount: 32000, perPerson: true },
                    { id: 'c_8', item: '飯店+地接', amount: 650000, perPerson: false }
                ]
            }
        }
    ];

    demoLines.forEach(lineData => {
        const { deadlines, todos, finances, ...rest } = lineData;
        const line = Store.addLine(rest);
        const stored = Store.getLine(line.id);
        stored.deadlines = deadlines;
        stored.todos = todos;
        stored.finances = finances;
    });

    Store.save();
}

// === Init ===
function init() {
    Store.load();
    seedDemoData();
    initEventListeners();
    Router.init();
    lucide.createIcons();
}

// Run
document.addEventListener('DOMContentLoaded', init);

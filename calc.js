const STORAGE_KEYS = {
    savedConfigs: 'damageCalcConfigs',
    lastConfig: 'damageCalcLastConfig'
};

const FIELD_GROUPS = [
    {
        id: 'attack',
        label: '攻击属性',
        fields: [
            ['baseAttack', '基础攻强', 0], ['pctAttack', '攻强增幅', 0],
            ['fixAttack', '固定攻强', 0], ['baseSG', '基础属攻', 0], ['pctSG', '属攻增幅', 0], ['tempSG', '临时属攻', 0]
        ]
    },
    {
        id: 'crit',
        label: '暴击与穿透',
        fields: [
            ['critValue', '暴击值', 750], ['critresist', '暴击抗性', 0], ['critnum', '爆伤值', 0], ['pctCritnum', '爆伤增幅', 0],
            ['hjct', '护甲穿透', 0], ['gwhj', '怪物护甲', 0], ['ysct', '元素穿透', 0], ['yskx', '元素抗性', 0]
        ]
    },
    {
        id: 'damage',
        label: '伤害乘区',
        fields: [
            ['slsh', '首领伤害', 0], ['jnsh', '技能伤害', 0], ['yssh', '元素伤害', 0],
            ['shjc', '伤害加成', 0], ['extraDamage', '额外伤害', 0]
        ]
    },
    {
        id: 'vulnerability',
        label: '易伤与宝石',
        fields: [
            ['ybys', '一般易伤', 0], ['cwys', '宠物易伤', 0], ['ysys', '元素易伤', 0],
            ['sxyz', '属性压制', 0], ['kzzf', '克制增幅', 0], ['shzf', '伤害增幅', 0]
        ]
    }
];

const FIELD_DEFINITIONS = FIELD_GROUPS.flatMap(group => group.fields.map(([id, label, defaultValue]) => ({
    id, label, defaultValue
})));
const FIELD_IDS = FIELD_DEFINITIONS.map(field => field.id);
const PERCENT_FIELDS = new Set(['pctAttack', 'pctSG', 'pctCritnum', 'slsh', 'jnsh', 'yssh', 'shjc', 'ybys', 'cwys', 'ysys', 'sxyz', 'kzzf', 'shzf', 'extraDamage']);
const DEFAULT_MAIN_INPUTS = Object.fromEntries(FIELD_DEFINITIONS.map(field => [field.id, field.defaultValue]));
const DEFAULT_SUPPORT_INPUTS = Object.fromEntries(FIELD_DEFINITIONS.map(field => [field.id, 0]));

let teamConfig = createDefaultTeam();
let savedConfigs = [];
let activeRole = 'mainC';
let previousTeamDamage = null;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeValue(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function normalizeValues(values, defaults) {
    return Object.fromEntries(FIELD_IDS.map(id => [id, normalizeValue(values?.[id], defaults[id])]));
}

function createDefaultSupport(index) {
    return {
        enabled: false,
        name: `辅助${index}`,
        values: clone(DEFAULT_SUPPORT_INPUTS)
    };
}

function createDefaultTeam() {
    return {
        version: 2,
        mainCName: '主C',
        mainC: clone(DEFAULT_MAIN_INPUTS),
        supports: [1, 2, 3].map(createDefaultSupport)
    };
}

function normalizeTeamConfig(raw) {
    if (!raw || raw.version !== 2) {
        return {
            version: 2,
            mainCName: '主C',
            mainC: normalizeValues(raw, DEFAULT_MAIN_INPUTS),
            supports: [1, 2, 3].map(createDefaultSupport)
        };
    }

    const supports = [1, 2, 3].map((index) => {
        const source = raw.supports?.[index - 1] || {};
        return {
            enabled: source.enabled === true,
            name: String(source.name || `辅助${index}`).slice(0, 20),
            values: normalizeValues(source.values, DEFAULT_SUPPORT_INPUTS)
        };
    });

    return {
        version: 2,
        mainCName: String(raw.mainCName || '主C').slice(0, 20),
        mainC: normalizeValues(raw.mainC, DEFAULT_MAIN_INPUTS),
        supports
    };
}

function normalizeSavedConfig(raw) {
    const config = normalizeTeamConfig(raw);
    return {
        ...config,
        id: Number(raw?.id) || Date.now() + Math.random(),
        name: String(raw?.name || '未命名配置').slice(0, 40)
    };
}

function safeParse(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function getActiveValues() {
    return activeRole === 'mainC' ? teamConfig.mainC : teamConfig.supports[Number(activeRole.slice(-1)) - 1].values;
}

function getActiveDefaults() {
    return activeRole === 'mainC' ? DEFAULT_MAIN_INPUTS : DEFAULT_SUPPORT_INPUTS;
}

function renderFieldGroups() {
    const container = document.getElementById('fieldGroups');
    container.innerHTML = FIELD_GROUPS.map((group, groupIndex) => `
        <section class="field-group">
            <button class="section-heading" type="button" data-target="fields-${group.id}" aria-expanded="${groupIndex === 0 ? 'true' : 'false'}">
                <span>${group.label}</span><span>展开 / 收起</span>
            </button>
            <div class="fields" id="fields-${group.id}" ${groupIndex === 0 ? '' : 'hidden'}>
                ${group.fields.map(([id, label]) => `
                    <label class="field" for="input-${id}">
                        <span>${label}</span>
                        <input id="input-${id}" data-field-id="${id}" type="number" min="0" step="any">
                    </label>
                `).join('')}
            </div>
        </section>
    `).join('');

    container.querySelectorAll('.section-heading').forEach(button => {
        button.addEventListener('click', () => {
            const fields = document.getElementById(button.dataset.target);
            const expanded = fields.hidden;
            fields.hidden = !expanded;
            button.setAttribute('aria-expanded', String(expanded));
        });
    });
}

function renderActiveRole() {
    const values = getActiveValues();
    const isMain = activeRole === 'mainC';
    const support = isMain ? null : teamConfig.supports[Number(activeRole.slice(-1)) - 1];
    const activeName = isMain ? teamConfig.mainCName : support.name;
    document.getElementById('editingTitle').textContent = `正在编辑：${activeName}`;
    document.getElementById('editingHint').textContent = isMain
        ? '主C自身面板，数值会直接参与伤害计算。'
        : '辅助增益面板，启用后数值会按对应字段加到主C。';
    document.getElementById('nameControl').hidden = false;
    document.getElementById('enabledControl').hidden = isMain;
    document.getElementById('roleName').value = activeName;
    if (support) document.getElementById('enabledInput').checked = support.enabled;

    document.querySelectorAll('[data-field-id]').forEach(input => {
        input.value = values[input.dataset.fieldId];
    });
    document.querySelectorAll('.member-card').forEach(card => {
        card.classList.toggle('active', card.dataset.role === activeRole);
    });
}

function formatValue(value) {
    return Number(value).toFixed(4);
}

function formatBuff(value) {
    return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatSupportValue(field, value) {
    return PERCENT_FIELDS.has(field.id) ? formatBuff(value) : formatValue(value);
}

function updateMemberCards(mainResult) {
    document.getElementById('mainCardSummary').innerHTML = `单人伤害 ${formatValue(mainResult.finalDamage)}<br>基础面板与最终输出`;
    document.querySelector('[data-role="mainC"] .member-name').textContent = teamConfig.mainCName;
    teamConfig.supports.forEach((support, index) => {
        const role = `support${index + 1}`;
        const card = document.querySelector(`[data-role="${role}"]`);
        const status = card.querySelector('.status-tag');
        const nonZero = FIELD_DEFINITIONS.filter(field => support.values[field.id] > 0);
        card.classList.toggle('enabled', support.enabled);
        card.classList.toggle('disabled', !support.enabled);
        card.querySelector('.member-name').textContent = support.name;
        status.textContent = support.enabled ? '已启用' : '未启用';
        status.classList.toggle('off', !support.enabled);
        card.querySelector('.card-summary').innerHTML = nonZero.length
            ? `${nonZero.map(field => `${field.label} +${formatSupportValue(field, support.values[field.id])}`).join('<br>')}`
            : '暂无增益<br>点击编辑并启用';
    });
}

function calculateValue(critValue) {
    if (critValue < 200) return critValue / 400;
    if (critValue < 500) return (critValue * 17) / 6000 - (critValue ** 2) / 600000;
    return critValue / 500;
}

function ysctValue(ysct, yskx) {
    if (ysct <= yskx) return 1505 / (yskx - ysct + 1505);
    return (ysct - yskx) / (ysct - yskx + 4000) + 1;
}

function hjctValue(hjct, gwhj) {
    return hjct < gwhj ? 1505 / (gwhj - hjct + 1505) : 1;
}

function calculateDamage(inputs) {
    const values = normalizeValues(inputs, DEFAULT_SUPPORT_INPUTS);
    const multipliers = {
        attack: ((values.baseAttack * (1 + values.pctAttack) + values.fixAttack) / 700 + 1),
        crit: Math.max(0, Math.min(calculateValue(values.critValue) - values.critresist, 1)) * (values.critnum * (1 + values.pctCritnum) + 150) / 100,
        attributeAttack: (values.baseSG * (1 + values.pctSG) + values.tempSG) / 700 + 1,
        elementPenetration: ysctValue(values.ysct, values.yskx),
        armorPenetration: hjctValue(values.hjct, values.gwhj),
        bossDamage: values.slsh + 1,
        skillDamage: values.jnsh + 1,
        elementDamage: values.yssh + 1,
        damageBonus: values.shjc + 1,
        vulnerability: (values.ybys + 1) * (values.cwys + 1) * (values.ysys + 1),
        gemAttribute: (values.sxyz + 1) * (values.kzzf + 1) * (values.shzf + 1),
        extraDamage: values.extraDamage + 1
    };
    const finalDamage = Object.values(multipliers).reduce((total, multiplier) => total * multiplier, 1);
    return { finalDamage, multipliers, inputs: values };
}

function getEffectiveInputs() {
    const effective = clone(teamConfig.mainC);
    teamConfig.supports.forEach(support => {
        if (!support.enabled) return;
        FIELD_IDS.forEach(id => {
            effective[id] += support.values[id];
        });
    });
    return normalizeValues(effective, DEFAULT_MAIN_INPUTS);
}

function renderMultipliers(multipliers) {
    const labels = {
        attack: '攻击系数', crit: '暴击系数', attributeAttack: '属攻系数', elementPenetration: '元素穿透',
        armorPenetration: '护甲穿透', bossDamage: '首领伤害', skillDamage: '技能伤害', elementDamage: '元素伤害',
        damageBonus: '伤害加成', vulnerability: '易伤效果', gemAttribute: '宝石属性', extraDamage: '额外伤害'
    };
    document.getElementById('multiplierDetails').innerHTML = Object.entries(multipliers).map(([key, value]) => `
        <div class="multiplier-item"><span>${labels[key]}</span><strong>${formatValue(value)}</strong></div>
    `).join('');
}

function saveLastConfig() {
    localStorage.setItem(STORAGE_KEYS.lastConfig, JSON.stringify(teamConfig));
}

function calculateAndRender() {
    const mainResult = calculateDamage(teamConfig.mainC);
    const teamResult = calculateDamage(getEffectiveInputs());
    const enabledCount = teamConfig.supports.filter(support => support.enabled).length;
    const buffCount = teamConfig.supports
        .filter(support => support.enabled)
        .reduce((count, support) => count + FIELD_IDS.filter(id => support.values[id] !== 0).length, 0);
    const change = mainResult.finalDamage === 0 ? 0 : (teamResult.finalDamage - mainResult.finalDamage) / mainResult.finalDamage * 100;
    document.getElementById('mainDamage').textContent = formatValue(mainResult.finalDamage);
    document.getElementById('teamDamage').textContent = formatValue(teamResult.finalDamage);
    document.getElementById('enabledCount').textContent = `${enabledCount} / 3`;
    document.getElementById('buffCount').textContent = String(buffCount);
    document.getElementById('teamChange').textContent = `较主C单人 ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    renderMultipliers(teamResult.multipliers);
    updateMemberCards(mainResult);
    saveLastConfig();
    previousTeamDamage = teamResult.finalDamage;
    return teamResult;
}

function updateConfigList() {
    const select = document.getElementById('configSelect');
    select.innerHTML = '<option value="">-- 选择配置 --</option>';
    savedConfigs.forEach(config => {
        const option = document.createElement('option');
        option.value = config.id;
        option.textContent = config.name;
        select.appendChild(option);
    });
}

function loadStoredData() {
    const storedConfigs = safeParse(localStorage.getItem(STORAGE_KEYS.savedConfigs), []);
    savedConfigs = Array.isArray(storedConfigs) ? storedConfigs.map(normalizeSavedConfig) : [];
    const storedLast = safeParse(localStorage.getItem(STORAGE_KEYS.lastConfig), null);
    teamConfig = normalizeTeamConfig(storedLast);
    updateConfigList();
}

function saveCurrentConfig() {
    const name = window.prompt('请输入队伍配置名称：');
    if (!name?.trim()) return;
    savedConfigs.push({ ...clone(teamConfig), id: Date.now(), name: name.trim().slice(0, 40) });
    localStorage.setItem(STORAGE_KEYS.savedConfigs, JSON.stringify(savedConfigs));
    updateConfigList();
}

function loadSelectedConfig() {
    const id = Number(document.getElementById('configSelect').value);
    const config = savedConfigs.find(item => item.id === id);
    if (!config) return;
    teamConfig = normalizeTeamConfig(config);
    activeRole = 'mainC';
    renderActiveRole();
    calculateAndRender();
}

function deleteSelectedConfig() {
    const select = document.getElementById('configSelect');
    const id = Number(select.value);
    if (!id) return;
    const config = savedConfigs.find(item => item.id === id);
    if (!config || !window.confirm(`确定删除配置“${config.name}”？`)) return;
    savedConfigs = savedConfigs.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.savedConfigs, JSON.stringify(savedConfigs));
    updateConfigList();
}

function compareConfigs() {
    const id = Number(document.getElementById('configSelect').value);
    const config = savedConfigs.find(item => item.id === id);
    const result = document.getElementById('compareResult');
    if (!config) {
        result.textContent = '请先选择一个已保存的队伍配置进行对比。';
        return;
    }
    const current = calculateDamage(getEffectiveInputs()).finalDamage;
    const selected = calculateDamage(getEffectiveInputsFromTeam(config)).finalDamage;
    const diff = selected === 0 ? 0 : (current - selected) / selected * 100;
    result.textContent = `当前队伍：${formatValue(current)} ｜ ${config.name}：${formatValue(selected)} ｜ 差异：${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`;
}

function getEffectiveInputsFromTeam(config) {
    const normalized = normalizeTeamConfig(config);
    const effective = clone(normalized.mainC);
    normalized.supports.forEach(support => {
        if (!support.enabled) return;
        FIELD_IDS.forEach(id => { effective[id] += support.values[id]; });
    });
    return normalizeValues(effective, DEFAULT_MAIN_INPUTS);
}

function bindEvents() {
    document.querySelectorAll('.member-card').forEach(card => {
        card.addEventListener('click', () => {
            activeRole = card.dataset.role;
            renderActiveRole();
        });
    });

    document.querySelectorAll('[data-field-id]').forEach(input => {
        input.addEventListener('input', () => {
            // Keep a trailing decimal point while the user is still typing, e.g. "0.".
            if (input.value === '' || input.value.endsWith('.')) return;
            const value = Number(input.value);
            if (!Number.isFinite(value) || value < 0) return;
            getActiveValues()[input.dataset.fieldId] = value;
            calculateAndRender();
        });
        input.addEventListener('change', () => {
            const value = normalizeValue(input.value, getActiveDefaults()[input.dataset.fieldId]);
            input.value = value;
            getActiveValues()[input.dataset.fieldId] = value;
            calculateAndRender();
        });
    });

    document.getElementById('roleName').addEventListener('input', event => {
        const value = event.target.value.slice(0, 20);
        if (activeRole === 'mainC') teamConfig.mainCName = value || '主C';
        else teamConfig.supports[Number(activeRole.slice(-1)) - 1].name = value || `辅助${activeRole.slice(-1)}`;
        renderActiveRole();
        calculateAndRender();
    });

    document.getElementById('enabledInput').addEventListener('change', event => {
        if (activeRole !== 'mainC') {
            teamConfig.supports[Number(activeRole.slice(-1)) - 1].enabled = event.target.checked;
            calculateAndRender();
        }
    });

    document.getElementById('resetCurrent').addEventListener('click', () => {
        const values = getActiveValues();
        Object.assign(values, clone(getActiveDefaults()));
        renderActiveRole();
        calculateAndRender();
    });
    document.getElementById('saveConfig').addEventListener('click', saveCurrentConfig);
    document.getElementById('loadConfig').addEventListener('click', loadSelectedConfig);
    document.getElementById('deleteConfig').addEventListener('click', deleteSelectedConfig);
    document.getElementById('compareConfig').addEventListener('click', compareConfigs);
}

window.addEventListener('DOMContentLoaded', () => {
    renderFieldGroups();
    loadStoredData();
    bindEvents();
    renderActiveRole();
    calculateAndRender();
});

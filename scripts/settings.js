import { Constants as C, allowTo, createBackup, defaultPermissions, getEmptyActiveSpeakers, getSettings, selectorArray } from "./const.js";
import { VisualNovelDialogues } from "./main.js";
import { VNLocation } from "./locationClass.js";
import { addMenuSetting, vndSelectorMenu, RestoreFromBackup, CreateBackup, CustomSlidersSet, PlayersPermissions } from './settingsMenu.js';
import { localizeConsts } from "./localizeConsts.js";

Hooks.once('init', function() {

    game.keybindings.register(C.ID, "turnVN", {
        name: game.i18n.localize(`${C.ID}.settings.turnVN`),
        editable: [
            {key: "KeyK"}
        ],
        onDown: () => {
        },
        onUp: (e) => {
            e.event.preventDefault();
            e.event.stopPropagation();
            VisualNovelDialogues.turnVN();
        }
    });

    game.keybindings.register(C.ID, "hiddenTurnVN", {
        name: game.i18n.localize(`${C.ID}.settings.hiddenTurnVN`),
        config: true,
        editable: [
            {key: "KeyL"}
        ],
        onDown: () => {
        },
        onUp: (e) => {
            e.event.preventDefault();
            e.event.stopPropagation();
            if (game.user.isGM) VisualNovelDialogues.turnVN([game.user.id]);
        },
        restricted: true
    });

    // Селектор
    // Меню селектора
    game.settings.registerMenu(C.ID, 'selectorMenu', {
        'name': game.i18n.localize(`${C.ID}.settings.selectorMenu`),
        'label': game.i18n.localize(`${C.ID}.settings.selectorMenuLabel`),
        'hint': game.i18n.localize(`${C.ID}.settings.selectorMenuHint`),
        'icon': 'fas fa-gears',
        restricted: true,
        'type': vndSelectorMenu,
    });
    // Опции меню селектора
    const registerSelectorSetting = (name) => {
        game.settings.register(C.ID, `selector${name}`, {
            name: `${name == "TabCompendium" ? "SIDEBAR" : "DOCUMENT"}.${name}`,
            scope: "client",
            config: false,
            type: Boolean,
            default: true,
        });
        addMenuSetting(`selector${name}`, 'selectorMenu');
    }
    Object.keys(selectorArray()).forEach(name => registerSelectorSetting(name))

    // Права игроков
    game.settings.registerMenu(C.ID, 'permissions', {
        'name': game.i18n.localize(`${C.ID}.settings.permissions`),
        'label': game.i18n.localize(`${C.ID}.settings.permissionsLabel`),
        'hint': game.i18n.localize(`${C.ID}.settings.permissionsHint`),
        'icon': 'fas fa-shield-alt',
        restricted: true,
        'type': PlayersPermissions,
    })

    // Сеты плашек
    game.settings.registerMenu(C.ID, 'customSliders', {
        'name': game.i18n.localize(`${C.ID}.settings.customSliders`),
        'label': game.i18n.localize(`${C.ID}.settings.customSlidersLabel`),
        'hint': game.i18n.localize(`${C.ID}.settings.customSlidersHint`),
        'icon': 'fas fa-layer-group',
        restricted: true,
        'type': CustomSlidersSet,
    });

    const registerSettings = (key, _scope = 'world', _config = true, _type = Boolean, _default = true, _filePicker = null, reRender = false, choices = null) => {
        game.settings.register(C.ID, key, {
            ...{
                name: game.i18n.localize(`${C.ID}.settings.${key}`),
                hint: game.i18n.localize(`${C.ID}.settings.${key}Hint`),
                scope: _scope,
                config: _config,
                type: _type,
                default: _default,
                onChange: (value) => {
                    if (reRender) VisualNovelDialogues.instance.render(true)
                }
            },
            ...(_filePicker ? {filePicker: _filePicker} : {}),
            ...(choices ? { choices: choices } : {})
        });
    }

    game.settings.registerMenu(C.ID, "restoreFromBackup", {
        name: game.i18n.localize(`${C.ID}.settings.restoreFromBackup`),
        label: game.i18n.localize(`${C.ID}.settings.restoreFromBackupLabel`),
        hint: game.i18n.localize(`${C.ID}.settings.restoreFromBackupHint`),
        icon: 'fas fa-file-code',
        restricted: true,
        type: RestoreFromBackup
    })
    game.settings.registerMenu(C.ID, "createBackup", {
        name: game.i18n.localize(`${C.ID}.settings.createBackup`),
        label: game.i18n.localize(`${C.ID}.settings.createBackupLabel`),
        hint: game.i18n.localize(`${C.ID}.settings.createBackupHint`),
        icon: 'fas fa-file-pen',
        restricted: true,
        type: CreateBackup
    })

    // Кнопка подсказки
    registerSettings("hintButton", "world", true, Boolean, true, null, true)
    // Кнопка настроек портрета в заголовке листа персонажа
    registerSettings("headerPortraitButton", "client", true, Boolean, false)
    // Отображается имя крайнего персонажа
    registerSettings("sideMainName", "client", true, Boolean, true, null, true)
    // Делать бекапы при запуске мира
    registerSettings("makesBackup", "world", true, Boolean, true)
    // Звук заявок
    registerSettings("requestsSound", "client", true, Boolean, true)
    // Отображать панель инструментов
    registerSettings("showToolbar", "client", true, Boolean, true)
    // Ширина портретов = ширина рамок
    registerSettings("worldWidthEqualFrame", "world", true, Boolean, false, null, true)
    // Каждое открытие окна Visual Novel считается принудительным
    registerSettings("permaForcedOpen", "world", true, Boolean, false)
    // Использовать токены в качестве изображения для Портретов по умолчанию
    registerSettings("useTokenForPortraits", "world", true, Boolean, false)
    // Шрифт
    const fonts = Object.keys(CONFIG.fontDefinitions).reduce((acc, key) => { acc[key] = key; return acc }, {});
    registerSettings("fontFamily", "client", true, String, "GWENT", null, true, fonts)
    // Смещение всех портретов по оси Y
    registerSettings("worldOffsetY", "world", true, Number, 0, null, true)
    // Количество слотов окна VN (на одной стороне)
    registerSettings("slotCount", "world", true, Number, 4, null, true)
    // z-index окна
    registerSettings("zIndex", "world", true, Number, 90, null, true)
    // Плейсхолдер фона
    registerSettings("backgroundPlaceholder", "world", true, String, "modules/visual-novel-dialogues/templates/assets/placeholderImage.webp", "image")
    // Дефолтная папка для поиска портретов
    registerSettings("portraitFoldersPath", "world", true, String, "", "folder")
    // Дефолтная папка для выбора фонов
    registerSettings("backgoundFoldersPath", "world", true, String, "", "folder")
    // Невъебически огромный текст для глобал-гайда
    registerSettings("globalGuideLocalization", "world", false, Object, {ru: localizeConsts.ru, en: localizeConsts.en})
    // Отображение для Monk Common Display
    registerSettings("monkCommonDisplay", "world", true, Boolean, true, null, true)
    // Использование Simple Calendar для отображения времени
    registerSettings("useSimpleCalendar", "world", true, Boolean, true, null, true)
    // Сохранение левых слотов
    registerSettings("persistentLeftSlots", "world", false, Object, {});
    // Автоматическое распределение слотов
    registerSettings("autoAssignSlots", "world", true, Boolean, true);

    // СКРЫТЫЕ
    registerSettings("playersPermissions", "world", false, Object, defaultPermissions, null, true)
    registerSettings("assetPacks", "world", false, Object, {locationPacks: [], portraitPacks: []}, null, true)
    registerSettings("showNewThingyDialog", "client", false, Boolean, true)

    globalThis.ui.VisualNovel = {
        updateLocalizeFromString: updateLocalizeFromString,
        updateLocalizeFromJournal: updateLocalizeFromJournal,
        createJournalFromLocalize: createJournalFromLocalize
    }
});

Hooks.on('setup', () => {
    game.settings.register(C.ID, 'style', {
        scope: 'world',
        type: Object,
        config: false,
        default: {
            sliderSets: [],
            choosenSliderSet: "",
        }
    })

    game.settings.register(C.ID, 'presetsUI', {
        scope: 'world',
        type: Object,
        config: false,
        default: {
            presets: [],
            choosenPreset: "",
        }
    })

    game.settings.register(C.ID, 'vnData', {
        scope: 'world',
        type: Object,
        default: {
            showVN: false,
            activeSpeakers: getEmptyActiveSpeakers(),
            activeSlots: {left: ["leftFirst"], right: ["rightFirst"]},
            editActiveSpeaker: "leftFirst",
            slidersText: {"left": [], "right": [], "center": []},
            order: {"left": [], "right": [], "center": []},
            portraits: [],
            location: new VNLocation({
                locationName: "???"
            }),
            locationList: [],
            locationFilters: [],
            showForIds: null,
            editMode: false,
            linkChanges: true,
            hideBack: false,
            hideUI: false,
            effects: {
                requests: {}
            },
            weatherList: [
                {
                    name: "Неизвестная погода",
                    icon: "fas fa-eye-slash",
                    id: foundry.utils.randomID()
                },
                {
                    name: "Солнечно",
                    icon: "fas fa-sun",
                    id: foundry.utils.randomID()
                },
                {
                    name: "Облачно",
                    icon: "fas fa-cloud-sun",
                    id: foundry.utils.randomID()
                },
                {
                    name: "Туман",
                    icon: "fas fa-smog",
                    id: foundry.utils.randomID()
                },
                {
                    name: "Ветренно",
                    icon: "fas fa-wind",
                    id: foundry.utils.randomID()
                }
            ]
        }
    });

    game.settings.register(C.ID, 'showVN', {
        scope: 'world',
        type: Boolean,
        default: false,
        onChange: value => {
            if (!game.user.getFlag(C.ID, "hideVN")) {
                VisualNovelDialogues.refresh("changeShow");
            } else {
                ui.notifications.warn(game.i18n.localize(`${C.ID}.visual-novel-dialogues.settings.hideInfo`));
            }
        }
    })

    VisualNovelDialogues.activate();

    CONFIG.Canvas.layers.visualNovelDialogues = { layerClass: VNDLayer, group: "interface" };
});

class VNDLayer extends foundry.canvas.layers.InteractionLayer {
    static LAYER_NAME = "visualNovelDialogues";
    constructor() {
        super();
    }

    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, {
            name: VNDLayer.LAYER_NAME,
            zIndex: 245
        });
    }
}

Hooks.on("ready", async () => {
    if (!game.user.isGM) return
    // Добавляем пунктик
    let permSettings = game.settings.get(C.ID, "playersPermissions")
    if (!permSettings["displayControl"]) {
        permSettings["displayControl"] = [3, 4]
        await game.settings.set(C.ID, "playersPermissions", permSettings)
    }
    let settings = getSettings()
    let hasChanges = false
    if (!settings.clockTime) {
        settings.clockTime = "12:30"
        hasChanges = true
    }
    if (hasChanges) await game.settings.set(C.ID, "vnData", settings)
    // Бекап
    if (game.settings.get(C.ID, "makesBackup")) {
        await createBackup();
    }

    // Стили
    document.documentElement.style.setProperty("--vsm-ui-border-color", "#44191A");
})

async function updateLocalizeFromString(lang = game.i18n.lang, text) {
    const globalGuideLocalization = game.settings.get(C.ID, "globalGuideLocalization")
    if (globalGuideLocalization && text) {
        globalGuideLocalization[lang] = text
        await game.settings.set(C.ID, "globalGuideLocalization", globalGuideLocalization)
        ui.notifications.info(game.i18n.localize(`${C.ID}.settings.localizeUpdated`))
    }
}

async function updateLocalizeFromJournal(lang = game.i18n.lang, journalId, pageId) {
    const text = game.journal.get(journalId)?.pages?.get(pageId)?.text?.content
    if (!text) {
        ui.notifications.error(game.i18n.localize(`${C.ID}.errors.noTextToImport`))
        return
    }
    await updateLocalizeFromString(lang, text)
}

async function createJournalFromLocalize(lang = game.i18n.lang) {
    const globalGuideLocalization = game.settings.get(C.ID, "globalGuideLocalization")
    if (globalGuideLocalization && globalGuideLocalization[lang]) {
        let pages = Object.entries(globalGuideLocalization).map(([key, value]) => {
            return {name: key, text: {content: value}}
        })
        let journalEntry = await JournalEntry.create({
            name: 'Visual Novel Dialogues localizations journal',
            pages: pages,
        });
    }
}

// Панель инструментов в левой части экрана
Hooks.on("getSceneControlButtons", (controls) => { pushControlButtons(controls) });
Hooks.on("renderSceneControls", (controls) => { });

function pushControlButtons(controls) {
    const showToolbar = game.settings.get(C.ID, "showToolbar");
    if (!showToolbar || !allowTo("displayControl")) return;

    // Проверяем, что controls — объект
    if (typeof controls !== "object" || controls === null) {
        console.error('Параметр controls не является объектом:', controls);
        return;
    }

    // Поиск группы "tokens" для добавления инструмента
    const tokenButtons = controls.tokens;
    if (tokenButtons) {
        // Убедимся, что tools — объект, если его нет, создаём пустой объект
        if (!tokenButtons.tools || typeof tokenButtons.tools !== "object") {
            tokenButtons.tools = {};
        }
        // Добавляем новый инструмент как ключ в объекте tools
        tokenButtons.tools["openWithControlledTokens"] = {
            name: "openWithControlledTokens",
            title: game.i18n.localize(`${C.ID}.toolbar.openWithControlledTokens`),
            icon: "fas fa-users-viewfinder",
            visible: true,
            button: true,
            onClick: async () => {
                const controlledActorIds = {
                    players: canvas.tokens.controlled.filter(t => t.actor?.type === "character").map(t => t.actor?.id),
                    npc: canvas.tokens.controlled.filter(t => t.actor?.type !== "character").map(t => t.actor?.id),
                };
                await parseActors(controlledActorIds);
            }
        };
    } else {
        console.warn('Группа "tokens" не найдена в controls:', controls);
    }

    // Добавляем новую группу управления в объект controls
    controls["VisualNovelToolbar"] = {
        name: "VisualNovelToolbar",
        title: "Visual Novel toolbar",
        icon: "fas fa-users-between-lines",
        layer: "visualNovelDialogues",
        order: 100,
        tools: [
            {
                name: "openVN",
                title: game.i18n.localize(`${C.ID}.toolbar.openVN`),
                icon: "fas fa-window-maximize",
                visible: true,
                button: true,
                onClick: () => { VisualNovelDialogues.turnVN(); }
            },
            {
                name: "hiddenOpenVN",
                title: game.i18n.localize(`${C.ID}.toolbar.hiddenOpenVN`),
                icon: "fas fa-eye-low-vision",
                visible: true,
                button: true,
                onClick: () => {
                    ui.notifications.info(game.i18n.localize(`${C.ID}.settings.showVNOnlyForYou`));
                    VisualNovelDialogues.turnVN([game.user.id]);
                }
            },
            {
                name: "openWithSceneTokens",
                title: game.i18n.localize(`${C.ID}.toolbar.openWithSceneTokens`),
                icon: "fas fa-users-rectangle",
                visible: true,
                button: true,
                onClick: async () => {
                    const actorOnSceneIds = {
                        players: canvas.tokens.placeables.filter(t => t.actor?.type === "character").map(t => t.actor?.id),
                        npc: canvas.tokens.placeables.filter(t => t.actor?.type !== "character").map(t => t.actor?.id),
                    };
                    await parseActors(actorOnSceneIds);
                }
            },
            {
                name: "openWithChoosenPlayers",
                title: game.i18n.localize(`${C.ID}.toolbar.openWithChoosenPlayers`),
                icon: "far fa-users-gear",
                visible: true,
                button: true,
                onClick: () => {
                    const players = game.users.filter(p => p.active);
                    let content = `<form class="flexcol">`;
                    for (let i = 0; i < players.length; i++) {
                        const player = players[i];
                        content += `
                            <div class="form-group vn-choose-players">
                                <img src="${player.avatar}">
                                <label for="vncp-${player.id}">${player.name}</label>
                                <input id="vncp-${player.id}" type="checkbox" name="${player.id}" checked>
                            </div>
                        `;
                    }
                    content += `</form>`;
                    new Dialog({
                        title: game.i18n.localize(`${C.ID}.toolbar.openWithChoosenPlayers`),
                        content: content,
                        buttons: {
                            submit: {
                                icon: "<i class='fas fa-users'></i>",
                                label: game.i18n.localize(`${C.ID}.toolbar.openWithChoosenPlayers`),
                                callback: (html) => {
                                    const checkedEls = html.find("input:checked");
                                    const ids = Array.from(checkedEls).map(el => el.name);
                                    VisualNovelDialogues.turnVN(ids);
                                }
                            }
                        }
                    }).render(true);
                }
            },
            {
                name: "forcedOpen",
                title: game.i18n.localize(`${C.ID}.toolbar.forcedOpen`),
                icon: "fas fa-people-pulling",
                visible: true,
                button: true,
                onClick: () => {
                    VisualNovelDialogues.turnVN(game.users.filter(p => p.active).map(p => p.id));
                }
            },
        ],
    };
}

async function parseActors(actorIds) {
    const settings = getSettings()
    settings.activeSpeakers = getEmptyActiveSpeakers()
    const portraits = settings.portraits
    const getPortraitData = (id) => portraits.find(portrait => portrait.id == id)

    const portraitIdList = portraits.map(portrait => portrait.id)
    const actorWithPortraitIds = {
        players: actorIds.players.filter(actorId => portraitIdList.includes(actorId)),
        npc: actorIds.npc.filter(actorId => portraitIdList.includes(actorId)),
    }

    const slotCount = game.settings.get(C.ID, "slotCount");
    // Игроки
    ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"].slice(0, Math.min(slotCount, actorWithPortraitIds.players.length)).forEach((num, i) => {
        settings.activeSpeakers[`left${num}`] = getPortraitData(actorWithPortraitIds.players[i])
    })
    if (actorWithPortraitIds.players.length > slotCount) {
        actorWithPortraitIds.players = actorWithPortraitIds.players.slice(slotCount)
        if (actorWithPortraitIds.players.length > 5) actorWithPortraitIds.players = actorWithPortraitIds.players.slice(0, 5)
        settings.order.left = actorWithPortraitIds.players.map(actorId => getPortraitData(actorId))
    }
    // НПС
    ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"].slice(0, Math.min(slotCount, actorWithPortraitIds.npc.length)).forEach((num, i) => {
        settings.activeSpeakers[`right${num}`] = getPortraitData(actorWithPortraitIds.npc[i])
    })
    if (actorWithPortraitIds.npc.length > slotCount) {
        actorWithPortraitIds.npc = actorWithPortraitIds.npc.slice(slotCount)
        if (actorWithPortraitIds.npc.length > 5) actorWithPortraitIds.npc = actorWithPortraitIds.npc.slice(0, 5)
        settings.order.right = actorWithPortraitIds.npc.map(actorId => getPortraitData(actorId))
    }
    await game.settings.set(C.ID, "vnData", settings)

    VisualNovelDialogues.turnVN()
}
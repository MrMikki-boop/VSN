import { Constants as C, uiButtonsIcons } from '../scripts/const.js';
import { VisualNovelDialogues } from '../scripts/main.js';
import { PresetUIClass } from '../scripts/presetUIClass.js';

export class VisualSettingsMenu extends FormApplication {
    constructor(mode = "home") {
        super();
        this.mode = "home";
        this.editablePreset = null
    }
    
    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            classes: ['visual-settings-menu-body'],
            width: "auto",
            height: "auto",
            resizable: false,
            id: "VisualSettingsMenu",
            template: `modules/${C.ID}/templates/visualSettingsMenu.hbs`,
            title: `Visual Settings Menu`,
            userId: game.userId,
            closeOnSubmit: false,
            submitOnChange: false
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        return mergedOptions;
    }

    getData(options) {
        const _mode = this.mode

        // UI menu
        const presetArray = [ ...game.settings.get(C.ID, 'presetsUI').presets ]
        const activePresetId = foundry.utils.deepClone(game.settings.get(C.ID, 'presetsUI')).choosenPreset
        if (!this.editablePreset) this.editablePreset = activePresetId || presetArray[0]?.id || null

        const preset = PresetUIClass.getPreset(this.editablePreset);
        const defaultSlotCount = game.settings.get(C.ID, 'slotCount')
        if (!preset.slotCount.left) preset.slotCount.left = defaultSlotCount
        if (!preset.slotCount.right) preset.slotCount.right = defaultSlotCount

        presetArray.forEach((p, i) => {if (!p.hotkey) presetArray[i].hotkey = game.i18n.localize(`${C.ID}.visualSettingsMenu.hotkeyPlaceholder`)})
        const pFields = {
            left: getPFields(preset.slotCount.left, preset.mainSlot.left),
            right: getPFields(preset.slotCount.right, preset.mainSlot.right).reverse(),
        }
        const data = {
            slotCountPlaceholder: defaultSlotCount,
            editblePresetId: this.editablePreset,
            choodedPresetId: activePresetId || null,
        }

        const settingsArray = (menus, keys) => {
            const menusArr = menus.reduce((acc, current) => {
                const _menu = game.settings.menus.get(`${C.ID}.${current}`)
                let item = {
                    button: true,
                    name: game.i18n.localize(`${C.ID}.settings.${current}`),
                    hint: game.i18n.localize(`${C.ID}.settings.${current}Hint`),
                    label: game.i18n.localize(`${C.ID}.settings.${current}Label`),
                    icon: _menu.icon,
                    key: current,
                    type: "button"
                }
                acc.push(item)
                return acc
            }, [])
            const keysArr = keys.reduce((acc, current) => {
                const _setting = game.settings.settings.get(`${C.ID}.${current}`)
                let item = {
                    name: game.i18n.localize(`${C.ID}.settings.${current}`),
                    hint: game.i18n.localize(`${C.ID}.settings.${current}Hint`),
                    value: game.settings.get(C.ID, current),
                    key: current,
                    type: typeof(_setting.type()),
                    filePicker: _setting.filePicker || null
                }
                if (_setting.choices) item.choices = Object.keys(_setting.choices).reduce((acc, current) => {
                    acc.push({key: current, value: _setting.choices[current]})
                    return acc
                }, [])
                acc.push(item)
                return acc
            }, [])
            return [...menusArr, ...keysArr]
        }

        // Visual settings menu
        const visualSettingsMenus = ["selectorMenu", "customSliders"]
        const visualSettingsKeys = ["hintButton", "sideMainName", "requestsSound", "worldWidthEqualFrame", "fontFamily", "worldOffsetY", "backgroundPlaceholder"]
        // Tech settings menu
        const techSettingsMenus = ["permissions", "restoreFromBackup", "createBackup"]
        const techSettingsKeys = ["headerPortraitButton", "makesBackup", "showToolbar", "permaForcedOpen", "useTokenForPortraits", "autoAssignSlots", "autoSceneData", "portraitFoldersPath", "backgroundFoldersPath", "zIndex"];
        // Modules settings menu
        const modulesSettingsMenus = []
        const modulesSettingsKeys = ["monkCommonDisplay", "useSimpleCalendar"]

        const settings = 
            _mode=== "menuVisual" ? settingsArray(visualSettingsMenus, visualSettingsKeys) : 
            _mode == "menuTech" ? settingsArray(techSettingsMenus, techSettingsKeys) :
            _mode == "menuModules" ? settingsArray(modulesSettingsMenus, modulesSettingsKeys) :
            null

        return { showMode: _mode, pFields: pFields, data: data, ...preset, presets: presetArray, settings: settings };
    }

    activateListeners(html) {
        super.activateListeners(html);
        // Главное меню
        if (this.mode == "home") {
            const menuButtons = html[0].querySelectorAll('.vsm-menu-button')
            // Кнопки в главном меню
            menuButtons.forEach(button => {
                button.addEventListener('click', async (event) => {
                    const mode = event.currentTarget.dataset.mode
                    this.mode = mode
                    if (mode == "menuUI") {
                        this.render(true, {left: window.innerWidth * 0.05, top: window.innerHeight * 0.1})
                    } else {
                        this.render(true)
                    }
                })
            })
        } else {
            // Вернуться в главное меню
            const backToMenuButtons = html[0].querySelectorAll('.vsm-toMenu-button')
            backToMenuButtons.forEach(button => {
                button.addEventListener('click', (event) => {
                    this.mode = "home"
                    this.render(true, {left: (window.innerWidth - 530) / 2, top: (window.innerHeight - 560) / 2})
                })
            })
        }
        

        // Меню настроек визуала/технических настроек/настроек модулей
        if (["menuVisual", "menuTech", "menuModules"].includes(this.mode)) {
            // FilePicker
            const filePickers = html[0].querySelectorAll('.vsm-filepicker')
            filePickers.forEach(filePicker => {
                filePicker.addEventListener('click', (event) => {
                    const input = html[0].querySelector(`.vsm-filepicker-input[name="${event.currentTarget.dataset.target}"]`)
                    new FilePicker({classes: ["filepicker"], type: event.currentTarget.dataset.type, displayMode: "thumbs", callback: async (image) => {
                        if (image) {
                            input.value = image
                        }
                    }}).render()
                })
            })

            // Кнопки настроек-меню
            const settingMenuButtons = html[0].querySelectorAll('.vsm-setting-menu-button')
            settingMenuButtons.forEach(button => {
                button.addEventListener('click', async (event) => {
                    const key = event.currentTarget.dataset.key
                    const menuSetting = game.settings.menus.get(`${C.ID}.${key}`)
                    const _class = menuSetting.type
                    new _class().render(true)
                })
            })

            // Сохранить настройки
            html[0].querySelector('.vsm-save-button')?.addEventListener('click', async (event) => {
                const settingEls = html[0].querySelectorAll('.vsm-setting-container')
                for (const el of settingEls) {
                    const settingType = el.dataset.type
                    if (settingType == "button") continue
                    const settingKey = el.dataset.key
                    const settingValue = 
                        settingType == "boolean" ? el.querySelector('input').checked : 
                        settingType == "number" ? parseInt(el.querySelector('input').value) : 
                        (el.querySelector('input')?.value || el.querySelector('select')?.value)

                    await game.settings.set(C.ID, settingKey, settingValue)
                }
                // VisualNovelDialogues.instance.render(true)
                if (settingKey === "autoAssignSlots" && settingValue) {
                    console.log("autoAssignSlots включено: игроки в левые слоты, NPC в правые");
                    const settingData = getSettings();
                    await autoAssignSlots(settingData);
                }
                if (settingKey === "autoSceneData" && settingValue) {
                    console.log("autoSceneData включено: данные локации берутся из активной сцены");
                    const settingData = getSettings();
                    await updateSceneData(settingData);
                }
                VisualNovelDialogues.renderForAll()
                ui.notifications.info(game.i18n.localize(`${C.ID}.visualSettingsMenu.saved`))
            })
        }

        // Меню настройки UI
        if (this.mode == "menuUI") {
            // Подсказка при наведении на элемент настройки
            const settingElements = html[0].querySelector('.vsm-UI').querySelectorAll('input, .vsm-pField, .vsm-mover-grab')
            const settingHintEl = html[0].querySelector(`.vsm-header .vsm-hint`)
            settingElements.forEach(el => {
                el.addEventListener('mouseover', (event) => {
                    const settingKey = el.dataset.key
                    const parts = settingKey.split(".")
                    settingHintEl.textContent = game.i18n.localize(`${C.ID}.uiSettingsMenuHints.${parts[0]}.${parts[1]}`)
                    settingHintEl.fontWeight = 900
                })
            })
            // Убираем подсказку когда убираем мышь
            settingElements.forEach(el => {
                el.addEventListener('mouseout', (event) => {
                    settingHintEl.textContent = game.i18n.localize(`${C.ID}.visualSettingsMenu.hintPlaceholder`)
                    settingHintEl.fontWeight = null
                })
            })

            // Добавить пресет
            html[0].querySelector('.vsm-add-preset')?.addEventListener('click', async (event) => {
                const newPresetId = await PresetUIClass.addPreset()
                this.editablePreset = newPresetId
                await new Promise((resolve) => setTimeout(resolve, 10)) 
                this.render()
            })

            // Удалить пресет
            html[0].querySelectorAll('.vsm-preset-delete')?.forEach(button => {
                button.addEventListener('click', async (event) => {
                    const _id = event.currentTarget.parentElement.dataset.id
                    await PresetUIClass.deletePreset(_id)
                    if (_id == this.editablePreset) this.editablePreset = null
                    await new Promise((resolve) => setTimeout(resolve, 10)) 
                    this.render()
                })
            })

            // Выбрать пресет в качестве редактируемого
            html[0].querySelectorAll('.vsm-preset:not(.vsm-preset-editing)')?.forEach(button => {
                button.addEventListener('contextmenu', async (event) => {
                    const _id = event.currentTarget.dataset.id || event.target.dataset.id
                    this.editablePreset = _id
                    await new Promise((resolve) => setTimeout(resolve, 10)) 
                    this.render()
                })
            })
            // Выбрать пресет в качестве активного
            html[0].querySelectorAll('.vsm-preset:not(.vsm-preset-active)')?.forEach(button => {
                button.addEventListener('click', async (event) => {
                    if (!event.target.classList.contains('vsm-preset')) return
                    const _id = event.currentTarget.dataset.id
                    await PresetUIClass.setPreset(_id)
                    // VisualNovelDialogues.instance.render(true)
                    VisualNovelDialogues.renderForAll()
                    await new Promise((resolve) => setTimeout(resolve, 10))
                    this.render()
                })
            })

            // Изменение любого инпута - появление кнопки "Сохранить"
            const uiMenuInputs = html[0].querySelector('.vsm-UI')?.querySelectorAll('input')
            uiMenuInputs?.forEach(input => {
                input.addEventListener('change', (event) => {
                    if (!this.editablePreset) {
                        ui.notifications.error(game.i18n.localize(`${C.ID}.visualSettingsMenu.noPresetToSaveError`))
                        return
                    }
                    html[0].querySelector('.vsm-ui-save-button')?.classList.remove('vsm-hidden')
                })
            })

            // Сохранение пресета UI
            html[0].querySelector('.vsm-ui-save-button')?.addEventListener('click', async (event) => {
                const editablePresetId = this.editablePreset
                if (!editablePresetId) {
                    ui.notifications.error(game.i18n.localize(`${C.ID}.visualSettingsMenu.noPresetToSaveError`))
                    return
                }
                const inputEls = html[0].querySelector('.vsm-UI')?.querySelectorAll('input')
                const presetData = Array.from(inputEls).reduce((acc, el) => {
                    const parts = el.dataset.key.split(".")
                    if (!acc[parts[0]]) acc[parts[0]] = {}

                    acc[parts[0]][parts[1]] = 
                        parts[0] == "activeElements" ? el.checked :
                        parts[0] == "slotCount" ? parseInt(el.value) :
                        el.value

                    return acc
                }, {offset: {}})

                const moverEls = html[0].querySelectorAll('.vsm-mover');
                moverEls.forEach(mover => {
                    const sliderType = mover.dataset.slider
                    const x = parseInt(mover.querySelector('.vsm-mover-X').textContent.split(": ")[1].split("%")[0]) || 0
                    const y = parseInt(mover.querySelector('.vsm-mover-Y').textContent.split(": ")[1].split("%")[0]) || 0

                    presetData.offset[`${sliderType}X`] = x
                    presetData.offset[`${sliderType}Y`] = y
                })

                await PresetUIClass.updatePreset(editablePresetId, presetData)
                await new Promise((resolve) => setTimeout(resolve, 10))
                // VisualNovelDialogues.instance.render(true)
                VisualNovelDialogues.renderForAll()
                this.render()
                ui.notifications.info(game.i18n.localize(`${C.ID}.visualSettingsMenu.saved`))
            })

            // Ресетнуть положение mover'а
            const moverResetEls = html[0].querySelectorAll('.vsm-mover-reset');
            moverResetEls.forEach(moverReset => {
                moverReset.addEventListener('click', (event) => {
                    const sliderType = moverReset.parentElement.dataset.slider
                    const sliderSide = sliderType.includes("right") ? "right" : "left"
                    const sliderEl = html[0].querySelector(`.vsm-move-${sliderType}`);
                    
                    const preset = new PresetUIClass()
                    const offset = preset.offset
                    sliderEl.style[sliderSide] = `${offset[`${sliderType}X`]}%`
                    sliderEl.style.top = `${offset[`${sliderType}Y`]}%`

                    const spanElX = moverReset.parentElement.querySelector('.vsm-mover-X');
                    const spanElY = moverReset.parentElement.querySelector('.vsm-mover-Y');
                    spanElX.innerHTML = `X: ${offset[`${sliderType}X`]}%`;
                    spanElY.innerHTML = `Y: ${offset[`${sliderType}Y`]}%`;
                })
            })
            // Перемещение элемента через mover
            const moverEls = html[0].querySelectorAll('.vsm-mover');
            moverEls.forEach(mover => {
                const editablePresetId = this.editablePreset;
                const grab = mover.querySelector('.vsm-mover-grab');
                const sliderType = mover.dataset.slider;
                const sliderSide = sliderType.includes("right") ? ("right") : ("left");
                const sliderEl = html[0].querySelector(`.vsm-move-${sliderType}`);
                const spanElX = mover.querySelector('.vsm-mover-X');
                const spanElY = mover.querySelector('.vsm-mover-Y');
                const parentEl = html[0].querySelector('.vsm-UI');

                let isDragging = false;
                let startX, startY, initialX, initialY, parentWidth, parentHeight;

                grab.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    parentWidth = parentEl.offsetWidth;
                    parentHeight = parentEl.offsetHeight;
                    initialX = parseInt(sliderEl.style[sliderSide]?.split("%")?.[0]) || 0;
                    initialY = parseInt(sliderEl.style.top?.split("%")?.[0]) || 0;
                    grab.style.cursor = 'grabbing';

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });

                function onMouseMove(e) {
                    if (!isDragging) return;
                    const dx = Math.round(((e.clientX - startX) / parentWidth) * 100);
                    const dy = Math.round(((e.clientY - startY) / parentHeight) * 100) * (sliderSide == "right" ? -1 : 1);
                    const shiftPressed = e.shiftKey;
                    const sideMod = sliderSide == "right" ? -1 : 1
                    if (shiftPressed) {
                        if (Math.abs(dx) > Math.abs(dy)) {
                            sliderEl.style[sliderSide] = `${(initialX + dx)}%`;
                            sliderEl.style.top = `${initialY}%`;
                            spanElX.innerHTML = `X: ${initialX + dx}%`;
                            spanElY.innerHTML = `Y: ${initialY}%`;
                        } else {
                            sliderEl.style.top = `${initialY + dy}%`;
                            sliderEl.style[sliderSide] = `${(initialX)}%`;
                            spanElX.innerHTML = `X: ${initialX}%`;
                            spanElY.innerHTML = `Y: ${initialY + dy}%`;
                        }
                    } else {
                        sliderEl.style.top = `${initialY + dy}%`;
                        sliderEl.style[sliderSide] = `${(initialX + dx)}%`;
                        spanElX.innerHTML = `X: ${initialX + dx}%`;
                        spanElY.innerHTML = `Y: ${initialY + dy}%`;
                    }
                }

                async function onMouseUp() {
                    isDragging = false;
                    grab.style.cursor = 'grab';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    if (!editablePresetId) {
                        ui.notifications.error(game.i18n.localize(`${C.ID}.visualSettingsMenu.noPresetToSaveError`));
                        return;
                    }
                    html[0].querySelector('.vsm-ui-save-button')?.classList.remove('vsm-hidden');
                }
            });

        }
    }

    async _updateObject(event, formData) {
    }
}

function getPFields(slotCount, mainSlot) {
    let arr = []
    for (let i = 0; i < slotCount; i++) {
        arr.push(((mainSlot === i) || (mainSlot == "first" && i == 0) || (mainSlot == "center" && i == Math.floor(slotCount / 2)) || (mainSlot == "last" && i == slotCount - 1)) ? 2 : 1)
    }
    return arr
}
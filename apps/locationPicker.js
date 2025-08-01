import { Constants as C, getEmptyActiveSpeakers, getLocation, getSettings, getTextureSize, requestSettingsUpdate } from '../scripts/const.js';
import { VNLocation } from '../scripts/locationClass.js';


const _getLocationColumns = (locations) => {
    const columns = locations.reduce((columns, location, i) => {
        columns[i % 6].push(location)
        return columns
    }, [[], [], [], [], [], []])
    return columns
}

const locationElement = (location, hasEditFilter = false) => {
    // Тело элемента
    const locationEl = document.createElement('div')
    locationEl.className = `lp-location-option flexcol${hasEditFilter ? ' lp-hlight-blue' : ''}`
    locationEl.dataset.id = location.id
    locationEl.addEventListener('click', locationListener)
    locationEl.addEventListener('contextmenu', async (event) => {
        event.preventDefault()
        const editableLocation = getSettings().locationList.find(m => m.id == event.currentTarget.dataset.id)
        const textureSize = await getTextureSize(editableLocation.backgroundImage)
        // new LocationPickerSettings({...editableLocation, ...textureSize}).render(true)
        LocationPickerSettings.open(event.currentTarget.dataset.id)
    })
    // Тело изображения
    const imgBodyEl = document.createElement('div')
    imgBodyEl.className = 'lp-location-img-body'
    imgBodyEl.innerHTML = `<img src="${location.backgroundImage}">`
    // Тело названия
    const nameBodyEl = document.createElement('div')
    nameBodyEl.className = 'lp-location-text-body'
    nameBodyEl.innerHTML = `<label>${location.locationName}</label>`
    // Кнопка удаления
    const deleteBtnEl = document.createElement('button')
    deleteBtnEl.className = 'lp-delete-button'
    deleteBtnEl.dataset.id = location.id
    deleteBtnEl.dataset.tooltip = game.i18n.localize(`${C.ID}.locationPicker.deleteLocation`)
    deleteBtnEl.type = "deleteLocation"
    deleteBtnEl.innerHTML = '<i class="fas fa-trash"></i>'
    deleteBtnEl.addEventListener('click', deleteButtonListener)

    locationEl.appendChild(imgBodyEl)
    locationEl.appendChild(nameBodyEl)
    locationEl.appendChild(deleteBtnEl)
    return locationEl
}

const locationListener = async (event) => {
    if (event.target.classList.contains('fa-trash')) return
    let editableFilter = LocationPicker.editableFilter
    const settings = getSettings()
    const location = settings.locationList.find(m => m.id == event.currentTarget.dataset.id)
    // Редактируемый фильтр выбран - добавление/удаление фильтра из списка тегов локации
    if (editableFilter) {
        if (location.locationTags.includes(editableFilter)) {
            location.locationTags = location.locationTags.filter(m => m != editableFilter)
            event.currentTarget.classList.remove('lp-hlight-blue')
        } else {
            location.locationTags.push(editableFilter)
            event.currentTarget.classList.add('lp-hlight-blue')
        }
        await VNLocation.updateFilterList(location.id, location.locationTags)
    // Редактируемый фильтр не выбран - выбор локации и установка её в качестве активной
    } else {
        // Если linkChanges == true - заменяем локацию на выбранную целиком
        if (settings.linkChanges) {
            settings.location = location
        // В ином случае, изменяем только фон
        } else {
            settings.location.backgroundImage = location.backgroundImage
        }
        await requestSettingsUpdate(settings, {change: ["changeLocation"]})
        LocationPicker.close()
    }
}

const deleteButtonListener = async (event) => {
    const settings = getSettings()
    const type = event.currentTarget.getAttribute('type')
    // Удалить фильтр
    if (type == "deleteFilter") {
        settings.locationFilters = settings.locationFilters.filter(m => m.name != event.currentTarget.dataset.name)
        await requestSettingsUpdate(settings)
        LocationPicker.refresh()
    // Удалить локацию
    } else if (type == "deleteLocation") {
        settings.locationList = settings.locationList.filter(m => m.id != event.currentTarget.dataset.id)
        await requestSettingsUpdate(settings)
        await LocationPicker.refresh()
    }
}

export class LocationPicker extends FormApplication {
    static instance = null;
    constructor(mode = "location", filterText = "") {
        super()
        this.mode = mode
        this.filterText = filterText
    }

    static activeFilters = []
    static editableLocation = null
    static editableFilter = null

    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            classes: ['vn-location-picker'],
            resizable: false,
            template: `modules/${C.ID}/templates/locationPicker.hbs`,
            title: game.i18n.localize(`${C.ID}.locationPicker.title`),
            userId: game.userId,
            closeOnSubmit: false,
            submitOnChange: false,
            scrollY: ['.lp-list-body']
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        return mergedOptions;
    }

    async getData(options) {
        const settings = getSettings()

        let data = {
            filterList: settings.locationFilters,
            filterText: this.filterText,
            placeholderText: this.mode == "parent" ? game.i18n.localize(`${C.ID}.locationPicker.placeholderParent`) : game.i18n.localize(`${C.ID}.locationPicker.placeholderLocation`),
        }
        const activeFilters = LocationPicker.activeFilters
        data.filterList.forEach(filter => {
            if (activeFilters.includes(filter.name)) {
                filter.active = true
            }
        })
        data.locations = this._filterLocations(null, data.activeFilters, data.filterText, this.mode);

        return { ...data };
    }

    _filterLocations(html, _filterList = [], _filterText = "", _mode = "location") {
        const filterText = html ? html[0].querySelector('.lp-search-input').value : _filterText
        const filterList = html ? Array.from(html[0].querySelectorAll('.lp-filter-option.lp-hlight')).map(element => element.getAttribute('data-name')) : _filterList
        const mode = html ? this.mode : _mode
        const locations = getSettings().locationList
        const _filter = (locations, filterText, filterList) => {
            let obj = {passed: locations, failed: locations}
            if (filterList.length) {
                obj.passed = obj.passed.filter(location => filterList.every(s => location.locationTags.includes(s)))
            }
            if (filterText) {
                obj.passed = obj.passed.filter(location => location[mode == "parent" ? "parentLocation" : "locationName"]?.includes(filterText))
            }
            obj.failed = obj.failed.filter(location => !obj.passed.includes(location))
            return obj
        }
        const filteredLocations = _filter(locations, filterText, filterList)
        const columns = _getLocationColumns(filteredLocations.passed)

        if (html) {
            const listBodyEl = html[0].querySelector('.lp-list-body')
            listBodyEl.innerHTML = ""
            columns.forEach((column) => {
                const colEl = document.createElement('div')
                colEl.className = 'lp-location-column flexcol'
                column.forEach(location => {
                    const locationEl = locationElement(location, (LocationPicker.editableFilter && location.locationTags.includes(LocationPicker.editableFilter)))
                    colEl.appendChild(locationEl)
                })
                listBodyEl.appendChild(colEl)
            })
        } else {
            return columns
        }
    }

    activateListeners(html) {
        super.activateListeners(html);
        // Добавить фильтр
        html.find('.lp-add-filter-button').on('click', (event) => {
            // new LocationPickerAddFilter().render(true)
            LocationPickerAddFilter().render(true)
        })
        // Добавить локацию
        html.find('.lp-add-location-button').on('click', (event) => {
            // new LocationPickerAddLocation().render(true)
            LocationPickerAddLocation().render(true)
        })
        // Массовый импорт
        html.find('.lp-mass-import-button').on('click', (event) => {
            new Dialog({
                title: game.i18n.localize(`${C.ID}.locationPicker.massImport.title`),
                content: `
                    <div class="form-group">
                        <span>${game.i18n.localize(`${C.ID}.locationPicker.massImport.text`)}</span>
                        <span><strong>${game.i18n.localize(`${C.ID}.locationPicker.massImport.strongText`)}</strong></span>
                        <div class="form-fields">
                            <button type="button" class="lpmi-file-picker" title="${game.i18n.localize(`${C.ID}.locationPicker.massImport.folder-button`)}">
                                <i class="fas fa-file-import"></i>
                            </button>
                            <input class="lpmi-choose-folder" type="text" placeholder="${game.i18n.localize(`${C.ID}.locationPicker.massImport.folder-path`)}">
                        </div>
                    </div>
                `,
                buttons: {
                    submit: {
                        label: game.i18n.localize(`${C.ID}.locationPicker.massImport.import`),
                        callback: async (html) => {
                            const path = html.find('.lpmi-choose-folder')[0].value
                            if (!path) return
                            const settings = getSettings()
                            const locationsImg = settings.locationList.map(location => location.backgroundImage)
                            let filters = settings.locationFilters.map(filter => filter.name)
                            const num = settings.locationList.length
                            const getName = (path, deleteDot = false) => {
                                path = path.match(/[^/]+$/)[0]
                                if (deleteDot) path = path.replace(/\..*$/, '')
                                path = decodeURI(path).replace(`%2C`, `,`)
                                return path
                            };
                            function addLocation(name, img, tag) {
                                const location = new VNLocation({locationName: name, backgroundImage: img, locationTags: [tag]})
                                settings.locationList.push(location)
                                if (!filters.includes(tag)) {
                                    settings.locationFilters.push({name: tag})
                                    filters.push(tag)
                                }
                            }
                            async function folderWork (path) {
                                let folder = null
                                try {folder = await FilePicker.browse("data", `${path}`)} catch (e) {console.error(e); return}
                                if (!folder) return
                                for (const file of folder.files) {
                                    if (locationsImg.includes(file) || locationsImg.includes(decodeURI(file).replace(`%2C`, `,`))) continue
                                    addLocation(getName(file, true), file, getName(path))
                                }
                                for (const dir of folder.dirs) {
                                    await folderWork(dir)
                                }
                            }
                            await folderWork(path)
                            if (settings.locationList.length > num) {
                                await requestSettingsUpdate(settings)
                                await LocationPicker.refresh()
                                ui.notifications.info(game.i18n.localize(`${C.ID}.locationPicker.massImport.success`) + (settings.locationList.length - num));
                            } else {
                                ui.notifications.error(game.i18n.localize(`${C.ID}.locationPicker.massImport.zero`));
                            }
                        }
                    },
                    cancel: {
                        label: game.i18n.localize(`${C.ID}.locationPicker.massImport.cancel`)
                    }
                },
                default: "cancel",
                render: (html) => { 
                    html.find('.lpmi-file-picker').on('click', async (event) => {
                        const fp = new FilePicker({classes: ["filepicker"], type: "folder", displayMode: "list", callback: async (path) => {
                            if (path) {
                                const input = html[0].querySelector('.lpmi-choose-folder')
                                input.value = path
                            };
                        }}).render();
                    })
                }
            }).render(true)
        })
        // Удалить
        html.find('.lp-delete-button').on('click', async (event) => {
            await deleteButtonListener(event)
        })
        // Смена режима поиска по тексту (поиск по названию локации / поиск по названию родительской локации)
        html.find('.lp-change-mode-button').on('click', (event) => {
            this.mode = this.mode == "parent" ? "location" : "parent"
            const input = html[0].querySelector('.lp-search-input')
            input.placeholder = this.mode == "parent" ? game.i18n.localize(`${C.ID}.locationPicker.placeholderParent`) : game.i18n.localize(`${C.ID}.locationPicker.placeholderLocation`)
            this._filterLocations(html)
        })
        // Поиск по тексту
        html.find('.lp-search-input').on('keyup', async (event) => {
            this._filterLocations(html)
        })
        html.find('.lp-search-input').on('keydown', function(event) {
            if (event.key === 'Enter') {
              event.preventDefault();
            }
        });
        // Очистить фильтры
        html.find('.lp-clear-filters-button').on('click', async (event) => {
            LocationPicker.activeFilters = []
            LocationPicker.refresh()
        })
        // ЛКМ по локации - выбрать в качестве текущей
        html.find('.lp-location-option').on('click', async (event) => {
            await locationListener(event)
        })
        // ПКМ по локации - настройки локации
        html.find('.lp-location-option').on('contextmenu', async (event) => {
            event.preventDefault()
            const editableLocation = getSettings().locationList.find(m => m.id == event.currentTarget.dataset.id)
            const textureSize = await getTextureSize(editableLocation.backgroundImage)
            // new LocationPickerSettings({...editableLocation, ...textureSize}).render(true)
            LocationPickerSettings.open(event.currentTarget.dataset.id)
        })
        // ЛКМ по фильтру
        html.find('.lp-filter-option').on('click', async (event) => {
            if (event.target.classList.contains('fa-trash')) return
            event.currentTarget.classList.toggle('lp-hlight')
            this._filterLocations(html)
        })
        // ПКМ по фильтру
        html.find('.lp-filter-option').on('contextmenu', async (event) => {
            event.preventDefault()
            let editableFilter = LocationPicker.editableFilter
            const locations = getSettings().locationList
            const filterName = event.currentTarget.dataset.name
            html[0].querySelectorAll('.lp-filter-option').forEach(element => {
                element.classList.remove('lp-hlight-blue')
            })
            const locationElements = html[0].querySelectorAll('.lp-location-option')
            locationElements.forEach(element => {
                element.classList.remove('lp-hlight-blue')
            })
            // Если выбран редактируемый фильтр - "выключаем" режим редактирования
            if (editableFilter && editableFilter == event.currentTarget.dataset.name) {
                LocationPicker.editableFilter = null
            // В ином случае, устанавливаем выбранный фильтр в качестве редактируемого
            } else {
                LocationPicker.editableFilter = filterName
                event.currentTarget.classList.add('lp-hlight-blue')
                locationElements.forEach(element => {
                    if (locations.find(f => f.id == element.dataset.id).locationTags.includes(filterName)) {
                        element.classList.add('lp-hlight-blue')
                    }
                })
            }
        });
    }

    static open(mode = "location", filterText = "") {
        LocationPicker.editableLocation = null

        if (!this.instance) {
            this.instance = new LocationPicker(mode, filterText);
        }

        if (!this.instance.rendered) {
            this.instance.mode = mode
            this.instance.filterText = filterText
            this.instance.render(true);
        } else {
            this.instance.bringToTop();
        }
    }

    static async refresh() {
        await this.instance?.render();
    }

    static close() {
        if (this.instance) {
            this.instance.close();
        }
    }

    async _updateObject(event, formData) {
    }
}


export class LocationPickerSettings extends FormApplication {
    static windows = {}
    constructor(locationData, changeCurrent = false) {
        super();
        this._text = {
            parName: locationData.parentLocation || "???",
            locName: locationData.locationName || "???",
            backgroundImage: locationData.backgroundImage || "",
        }
        this._locationData = locationData
        this._id = locationData.id
        this._changeCurrent = changeCurrent
    }
    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            title: game.i18n.localize(`${C.ID}.locationPickerSub.altTitle`),
            classes: ['vn-location-picker-sub'],
            width: 420,
            resizable: false,
            template: `modules/${C.ID}/templates/locationPickerSub.hbs`,
            title: game.i18n.localize(`${C.ID}.locationPickerSub.title`),
            userId: game.userId,
            closeOnSubmit: true,
            submitOnChange: false
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        return mergedOptions;
    }

    // Бля сорян, я эту абсолютную хуйню в говнище писал, и, каюсь, переписывать не буду.
    static open(id = "current") {
        const changeCurrent = (id == "current")
        const settings = getSettings()
        const locationData = changeCurrent ? settings.location : settings.locationList.find(m => m.id == id)
        if (!this.windows[id]) {
            if (!locationData) return
            this.windows[id] = new LocationPickerSettings(locationData, changeCurrent);
        }

        if (!this.windows[id].rendered) {
            this.windows[id]._locationData = locationData
            this.windows[id]._id = locationData.id
            this.windows[id]._changeCurrent = changeCurrent
            this.windows[id]._text = {
                parName: locationData.parentLocation || "???",
                locName: locationData.locationName || "???",
                backgroundImage: locationData.backgroundImage || "",
            }
            this.windows[id].render(true);
        } else {
            this.windows[id].bringToTop();
        }
    }

    static close(id) {
        LocationPickerSettings.windows[id]?.close();
    }

    static refresh(id = "current") {
        const changeCurrent = (id == "current")
        const settings = getSettings()
        const locationData = changeCurrent ? settings.location : settings.locationList.find(m => m.id == id)
        LocationPickerSettings.windows[id]._locationData = locationData
        LocationPickerSettings.windows[id]._id = locationData.id
        LocationPickerSettings.windows[id]._changeCurrent = changeCurrent
        LocationPickerSettings.windows[id]._text = {
            parName: locationData.parentLocation || "???",
            locName: locationData.locationName || "???",
            backgroundImage: locationData.backgroundImage || "",
        }
        LocationPickerSettings.windows[id]?.render();
    }

    getData(options) {
        const text = this._text
        let location = this._locationData
        if (location) {
            if (!location.scale) location.scale = 100
            if (!location.offsetX) location.offsetX = 0
            if (!location.offsetY) location.offsetY = 0
            const slotCount = Math.min(game.settings.get(C.ID, "slotCount"), 5)
            location.presets = location.presets?.map(m => {
                let num = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"].splice(0, slotCount)
                let arr = num.reduce((acc, el, i) => {
                    acc.push(m.portraits[`left${el}`] || {})
                    return acc
                }, [])
                num.reverse()
                arr = arr.concat(num.reduce((acc, el, i) => {
                    acc.push(m.portraits[`right${el}`] || {})
                    return acc
                }, []))
                m.portraits = arr
                return m
            })
        }
        return { ...text, location: location }
    }
    activateListeners(html) {
        super.activateListeners(html);
        html.find('.lps-file-picker').on('click', async (event) => {
            const fp = new FilePicker({classes: ["filepicker"], current: C.backgoundFoldersPath(), type: "image", displayMode: "thumbs", callback: async (image) => {
                if (image) {
                    const input = html[0].querySelector('.lps-choose-img')
                    input.value = image
                };
            }}).render();
        })
        const id = this._id
        const changeCurrent = this._changeCurrent

        html.find('.lps-submit-button').on('click', async (event) => {
            const settings = getSettings()
            const _linkChanges = (changeCurrent || (settings.location.id == id)) && settings.linkChanges
            let locations = changeCurrent ? [settings.location] : [settings.locationList.find(m => m.id == id)]
            if (_linkChanges) locations.push(changeCurrent ? settings.locationList.find(m => m.id == id) : settings.location)
            locations.forEach(l => {
                if (!l) return
                l.locationName = html[0].querySelector('.lps-loc-input').value || "???"
                l.parentLocation = html[0].querySelector('.lps-par-input').value || "???"
                l.backgroundImage = html[0].querySelector('.lps-choose-img').value || C.backgroundPlaceholder()
            })
            await requestSettingsUpdate(settings, ((_linkChanges || changeCurrent) ? {change: ["changeLocation"]} : {}))
            await LocationPicker.refresh()
            ui.notifications.info(game.i18n.localize(`${C.ID}.locationPickerSub.location.successUpdate`));
        });
        // Добавить пустой пресет
        async function addPreset(copyPotraits) {
            const settings = getSettings()
            const presetData = {
                locationData: settings.location,
                portraits: copyPotraits ? settings.activeSpeakers : {},
                id: randomID()
            }
            const _linkChanges = (changeCurrent || (settings.location.id == id)) && settings.linkChanges
            let locations = changeCurrent ? [settings.location] : [settings.locationList.find(m => m.id == id)]
            if (_linkChanges) locations.push(changeCurrent ? settings.locationList.find(m => m.id == id) : settings.location)
            locations.forEach(l => {if (!l.presets) l.presets = []; l.presets.push(deepClone(presetData))})
            await requestSettingsUpdate(settings)
            LocationPickerSettings.refresh(changeCurrent ? "current" : id)
        }
        html.find('.lps-preset-add').on('click', async (event) => {
            await addPreset(false)
        })
        // Создать "слепок" пресета из текущих портретов
        html.find('.lps-preset-snapshot').on('click', async (event) => {
            await addPreset(true)
        })
        // Удалить пресет
        html.find('.lps-delete-button').on('click', async (event) => {
            const settings = getSettings()
            const _linkChanges = (changeCurrent || (settings.location.id == id)) && settings.linkChanges
            let locations = changeCurrent ? [settings.location] : [settings.locationList.find(m => m.id == id)]
            if (_linkChanges) locations.push(changeCurrent ? settings.locationList.find(m => m.id == id) : settings.location)
            locations.forEach(l => {if (!l.presets) l.presets = []; l.presets = l.presets.filter(p => p.id != event.currentTarget.parentElement.dataset.id)})
            await requestSettingsUpdate(settings)
            LocationPickerSettings.refresh(changeCurrent ? "current" : id)
        })
        // Выбрать пресет
        html.find('.lps-preset-container').on('click', async (event) => {
            if (event.currentTarget.classList.contains('lps-delete-button') || event.target.classList.contains('lps-delete-button')) return
            const settings = getSettings()
            const targetLocation = changeCurrent ? settings.location : settings.locationList.find(m => m.id == id)
            const preset = deepClone(targetLocation.presets.find(p => p.id == event.currentTarget.dataset.id))
            const oldPresets = targetLocation.presets
            settings.location = preset.locationData
            settings.location.presets = oldPresets
            const hiddenPortElements = event.currentTarget.querySelectorAll('.lps-preset-portrait.lps-hidden-portrait')
            const hiddenPortIds = Array.from(hiddenPortElements).map(p => p.dataset.id)
            const presetSpeakers = Object.keys(preset.portraits).reduce((acc, key) => {
                if (hiddenPortIds.includes(acc[key]?.id)) acc[key] = null
                return acc
            }, preset.portraits)
            const newSpeakers = foundry.utils.mergeObject(getEmptyActiveSpeakers(), presetSpeakers)
            settings.activeSpeakers = newSpeakers
            await requestSettingsUpdate(settings, {change: ["changeLocation", "editPortrait"], positions: Object.keys(newSpeakers)})
        })
        // ПКМ на портрет в пресете скрывает его (при выборе пресета портрет не переносится)
        html.find('.lps-preset-portrait').on('contextmenu', async (event) => {
            event.preventDefault()
            event.currentTarget.classList.toggle('lps-hidden-portrait')
        })

        // Изменение масштаба
        
        // Временно отложено по причине задушился
        
        // const backgroundEl = document.getElementById("vn-background-image")
        // // - Изменение масштаба
        // html.find('input[name="scale"]').on('input', function(event) {
        //     $(this).addClass('vn-hlight');
        //     console.log("scaleValue", event.currentTarget.value)
        //     backgroundEl.style["background-size"] = `${event.currentTarget.value}%`;
        //     const counterEl = html.find('.range-scale-value-background');
        //     counterEl.text(`${event.currentTarget.value}%`);
        // })
        // // - Перемещение портрета по оси X
        // html.find('input[name="coordX"]').on('input', function(event) {
        //     $(this).addClass('vn-hlight');
        //     console.log("xValue", event.currentTarget.value)
        //     console.log("window", window.innerWidth)
        //     console.log("location.x", location.x)
        //     backgroundEl.style["background-position-x"] = `${parseInt(event.currentTarget.value)-(window.innerWidth-location.x)/2}px`;
        //     const counterEl = html.find(`.range-coordX-value-background`);
        //     counterEl.text(event.currentTarget.value);
        // })
        // // - Перемещение портрета по оси Y
        // html.find('input[name="coordY"]').on('input', function(event) {
        //     $(this).addClass('vn-hlight');
        //     console.log("yValue", event.currentTarget.value)
        //     backgroundEl.style["background-position-y"] = `${parseInt(event.currentTarget.value)*-1 - (window.innerHeight-location.y)/2}px`;
        //     const counterEl = html.find(`.range-coordY-value-background`);
        //     counterEl.text(event.currentTarget.value);
        // })
    }
    async _updateObject(event, formData) {
    }
}

// export class LocationPickerSettings extends _LocationPickerSub {

//     async presetListener(event, id) {
//         const settings = getSettings()
//         const preset = deepClone(settings.locationList.find(m => m.id == id).presets.find(p => p.id == event.currentTarget.dataset.id))
//         settings.location = preset.locationData
//         const hiddenPortElements = event.currentTarget.querySelectorAll('.lps-preset-portrait.lps-hidden-portrait')
//         const hiddenPortIds = Array.from(hiddenPortElements).map(p => p.dataset.id)
//         const presetSpeakers = Object.keys(preset.portraits).reduce((acc, key) => {
//             if (hiddenPortIds.includes(acc[key]?.id)) acc[key] = null
//             return acc
//         }, preset.portraits)
//         const newSpeakers = foundry.utils.mergeObject(getEmptyActiveSpeakers(), presetSpeakers)
//         settings.activeSpeakers = newSpeakers
//         await game.settings.set(C.ID, 'vnData', settings, {change: ["changeLocation", "editPortrait"], positions: Object.keys(newSpeakers)})
//     }

//     async deleteListener(event, changeCurrent, id, html) {
//         const settings = getSettings()
//         let locations = changeCurrent ? [settings.location] : [settings.locationList.find(m => m.id == id)]
//         if (settings.linkChanges) locations.push(changeCurrent ? settings.locationList.find(m => m.id == id) : settings.location)
//         locations.forEach(l => {if (!l.presets) l.presets = []; l.presets = l.presets.filter(p => p.id != event.currentTarget.parentElement.dataset.id)})
//         await game.settings.set(C.ID, 'vnData', settings)
//         this.reRednerPresets(html[0].querySelector('.lps-preset-body'), locations[0].presets, changeCurrent, id, html)
//     }

//     reRednerPresets(presetBodyEl, presets, changeCurrent, id, html) {
//         presetBodyEl.innerHTML = `<div class="form-fields" style="margin-top: 5px; margin-bottom: 5px;">`;
//         const slotCount = Math.min(game.settings.get(C.ID, "slotCount"), 5)
//         presets = presets?.map(m => {
//             let num = ["First", "Second", "Third", "Fourth", "Fifth"].splice(0, slotCount)
//             let arr = num.reduce((acc, el) => {
//                 acc.push(m.portraits[`left${el}`] || {})
//                 return acc
//             }, [])
//             num.reverse()
//             arr = arr.concat(num.reduce((acc, el) => {
//                 acc.push(m.portraits[`right${el}`] || {})
//                 return acc
//             }, []))
//             m.portraits = arr
//             return m
//         })
//         for (const preset of presets) {
//             presetBodyEl.innerHTML += `
//                 <div class="lps-preset-container" data-id="${preset.id}">
//                     <div class="lps-preset-locInfo flexrow">
//                         <div class="lps-preset-names">
//                             <span class="lps-preset-name">${preset.locationData.locationName}</span>
//                             <span class="lps-preset-parName">${preset.locationData.parentLocation}</span>
//                         </div>
//                         <div class="lps-weather">
//                             <i class="fas ${preset.locationData.weather.icon}"></i>
//                             <span>${preset.locationData.weather.name}</span>
//                         </div>
//                         <div class="lps-temperature">
//                             <span>${preset.locationData.temperature}°C</span>
//                         </div>
//                     </div>
//                     <div class="lps-preset-portraits flexrow">
//                         ${preset.portraits.reduce((acc, portrait) => {
//                             return acc + `<div class="lps-preset-portrait" data-tooltip="${portrait.name}" data-id="${portrait.id}">
//                                 <img src="${portrait.img || ""}"/> 
//                             </div>`
//                         }, '')}
//                     </div>
//                     <button type="button" class="lps-delete-button" data-tooltip="${game.i18n.localize('visual-novel-dialogues.locationPickerSub.deletePreset')}"><i class="fas fa-trash"></i></button>
//                 </div>`
//         }
//         presetBodyEl.innerHTML += `</div>`;
//         const deleteButtons = html[0].querySelectorAll('.lps-delete-button')
//         for (const button of deleteButtons) {
//             button.addEventListener('click', this.deleteListener.bind(this, changeCurrent, id, html))
//         }
//         const presetContainers = html[0].querySelectorAll('.lps-preset-container')
//         for (const container of presetContainers) {
//             container.addEventListener('click', this.presetListener.bind(this, id))
//         }
//     }
// }

const _content = (category) => {
    return `
        <form id="vn-location-picker-sub">
            <h3 class="lps-title">${game.i18n.localize(`${C.ID}.locationPickerSub.${category}.imageHeader`)}</h3>
            <div class="form-group">
                <span class="lps-span">${game.i18n.localize(`${C.ID}.locationPickerSub.image-path`)}</span>
                <div class="form-fields">
                    <button type="button" class="lps-file-picker" title="${game.i18n.localize(`${C.ID}.locationPickerSub.image-button`)}">
                        <i class="fas fa-file-import"></i>
                    </button>
                    <input class="image lps-choose-img" type="text" placeholder="path/image.png" value="">
                </div>
            </div>
            <h3 class="lps-title" style="margin-top: 9px;">${game.i18n.localize(`${C.ID}.locationPickerSub.${category}.nameHeader`)}</h3>
            <div class="form-group">
                <div class="form-fields">
                    <input class="lps-loc-input" type="text" placeholder="${game.i18n.localize(`${C.ID}.locationPickerSub.${category}.namePlaceholder`)}" value="">
                </div>
            </div>
            ${category == `location` ? `
                <h3 class="lps-title" style="margin-top: 9px;">${game.i18n.localize(`${C.ID}.locationPickerSub.location.parNameHeader`)}</h3>
                <div class="form-group">
                    <div class="form-fields">
                        <input class="lps-par-input" type="text" placeholder="${game.i18n.localize(`${C.ID}.locationPickerSub.location.parNamePlaceholder`)}" value="">
                    </div>
                </div>
            ` : ``}
        </form>
    `
}

const LocationPickerAddFilter = () => new Dialog(
    {
        title: game.i18n.localize(`${C.ID}.locationPickerSub.title`),
        content: _content('filter'),
        buttons: {
            common: { icon: '<i class=""></i>', label: game.i18n.localize(`${C.ID}.locationPickerSub.submit`), callback: async (html) => {
                const settings = getSettings()
                const filterData = {
                    name: html[0].querySelector('.lps-loc-input').value,
                    image: html[0].querySelector('.lps-choose-img').value
                }
                settings.locationFilters.push(filterData)
                await requestSettingsUpdate(settings)
                await LocationPicker.refresh()
                ui.notifications.info(game.i18n.localize(`${C.ID}.locationPickerSub.filter.success`));
            }},
        },
        default: "common",
        render: (html) => { 
            html.find('.lps-file-picker').on('click', async (event) => {
                const fp = new FilePicker({classes: ["filepicker"], current: C.backgoundFoldersPath(), type: "image", displayMode: "thumbs", callback: async (image) => {
                    if (image) {
                        const input = html[0].querySelector('.lps-choose-img')
                        input.value = image
                    };
                }}).render();
            })
        },
    }
)

const LocationPickerAddLocation = () => new Dialog(
    {
        title: game.i18n.localize(`${C.ID}.locationPickerSub.title`),
        content: _content('location'),
        buttons: {
            common: { icon: '<i class=""></i>', label: game.i18n.localize(`${C.ID}.locationPickerSub.submit`), callback: async (html) => {
                const settings = getSettings()
                const location = new VNLocation({
                    locationName: html[0].querySelector('.lps-loc-input').value,
                    backgroundImage: html[0].querySelector('.lps-choose-img').value,
                    parentLocation: html[0].querySelector('.lps-par-input').value
                })
                settings.locationList.push(location)
                await requestSettingsUpdate(settings)
                await LocationPicker.refresh()
                ui.notifications.info(game.i18n.localize(`${C.ID}.locationPickerSub.location.success`));
            }},
        },
        default: "common",
        render: (html) => { 
            html.find('.lps-file-picker').on('click', async (event) => {
                const fp = new FilePicker({classes: ["filepicker"], current: C.backgoundFoldersPath(), type: "image", displayMode: "thumbs", callback: async (image) => {
                    if (image) {
                        const input = html[0].querySelector('.lps-choose-img')
                        input.value = image
                    };
                }}).render();
            })
        },
    }
)

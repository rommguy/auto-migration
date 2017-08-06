define([
    'react',
    'lodash',
    'panels',
    'core',
    'compPanels/mixins/compPanelFrameMixin'
], function (React,
             _,
             panels,
             core,
             compPanelFrameMixin) {
    'use strict';

    function getValueByKey(key, data) {
        return data && _.get(data, key);
    }

    function onValueChanged(key, type, newVal, dontAddToUndoRedoStack) {
        this.setValueByKey(key, newVal, type, dontAddToUndoRedoStack);
    }

    function linkedLayout(keys) {
        if (_.isArray(keys)) {
            return {
                value: _.pick(this.layout, keys),
                requestChange: onLayoutChanged.bind(this, keys)
            };
        }
        return {
            value: this.layout[keys],
            requestChange: onLayoutChanged.bind(this, keys)
        };
    }

    function onLayoutChanged(keys, newVal) {
        var layout = _.cloneDeep(this.layout);

        if (_.isArray(keys)) {
            _.merge(layout, newVal);
        } else {
            layout[keys] = newVal;
        }

        this.props.layoutUpdate(this.props.selectedComponent, layout);
    }

    function linkedValue(key, type) {
        if (_.isUndefined(key)) {
            return {
                value: this[type],
                requestChange: onValueChanged.bind(this, key, type)
            };
        }
        if (_.isArray(key)) {
            return {
                value: _.merge(_.pick(this[type], key), _.zipObject(key)),
                requestChange: onValueChanged.bind(this, key, type)
            };
        }
        return {
            value: getValueByKey(key, this[type]),
            requestChange: onValueChanged.bind(this, key, type)
        };
    }

    return {
        propTypes: {
            selectedComponent: React.PropTypes.arrayOf(React.PropTypes.object)
        },

        mixins: [core.mixins.editorAPIMixin, compPanelFrameMixin, panels.mixins.reportBiEventOnUiChangeMixin],

        getInitialState: function () {
            this.data = this.props.data;
            this.properties = this.props.properties;
            this.layout = this.props.relativeToStructure;
            this.design = this.props.design;

            return {
                showHelp: false
            };
        },

        componentWillReceiveProps: function (nextProps) {
            if (this.props.isExist(nextProps.selectedComponent)) {
                this.data = this.props.dataGet(nextProps.selectedComponent);
                this.properties = this.props.propertiesGet(nextProps.selectedComponent);
                this.layout = this.props.layoutGetRelativeToStructure(nextProps.selectedComponent);
                this.design = this.props.designGet(nextProps.selectedComponent);
            }
        },

        linkedData: function (dataFieldName) {
            return linkedValue.call(this, dataFieldName, 'data');
        },

        linkedProperty: function (propFieldName) {
            return linkedValue.call(this, propFieldName, 'properties');
        },

        linkedDesign: function (propFieldName) {
            return linkedValue.call(this, propFieldName, 'design');
        },

        linkedLayout: function (layoutFieldNames) {
            return linkedLayout.call(this, layoutFieldNames);
        },

        getData: function (fieldName) {
            var data = getValueByKey(fieldName, this.data);
            // Patch to allow opening the designData experiment in viewer without the editor knowing about it
            // If data is missing on the document_data map we try finding it on the design_data
            if (_.isUndefined(data) && !_.isUndefined(this.design)) {
                data = getValueByKey(fieldName, this.design);
            }
            return data;
        },

        getDesign: function (fieldName) {
            return getValueByKey(fieldName, this.design);
        },

        updateData: function (fieldName, newVal) {
            onValueChanged.call(this, fieldName, 'data', newVal);
        },

        updateDesign: function (fieldName, newVal, dontAddToUndoRedoStack) {
            onValueChanged.call(this, fieldName, 'design', newVal, dontAddToUndoRedoStack);
        },

        getProperty: function (fieldName) {
            return getValueByKey(fieldName, this.properties);
        },

        updateProperty: function (fieldName, newVal, dontAddToUndoRedoStack) {
            onValueChanged.call(this, fieldName, 'properties', newVal, dontAddToUndoRedoStack);
        },

        getLayout: function (fieldName) {
            return getValueByKey(fieldName, this.layout);
        },

        updateLayout: function (fieldName, newVal) {
            onLayoutChanged.call(this, fieldName, newVal);
        },

        toggleHelp: function () {
            var newShowHelp = !this.state.showHelp;
            this.setState({
                showHelp: newShowHelp
            });
        },

        setValueByKey: function (key, val, type, dontAddToUndoRedoStack) {
            var newData = _.cloneDeep(this[type]) || {};

            if (_.isUndefined(key)) {
                newData = val;
            } else if (_.isArray(key) && _.isObject(val)) {
                var newValues = _.pick(val, key);
                _.assign(newData, newValues);
            } else if (_.isObject(key)) {
                _.assign(newData, key);
            } else {
                _.set(newData, key, val);
            }

            //hack for ds.property.update, id is required
            newData.id = (newData && newData.id) ? newData.id : (this.data && this.data.id);

            if (type === 'data') {
                this.props.dataUpdate(this.props.selectedComponent, newData, dontAddToUndoRedoStack);
            } else if (type === 'design') {
                this.props.designUpdate(this.props.selectedComponent, newData, false, dontAddToUndoRedoStack);
            } else {
                this.props.propertiesUpdate(this.props.selectedComponent, newData, dontAddToUndoRedoStack);
            }
            return newData;
        },

        openHelpCenter: function (helpId, isFromLearnMore) {
            if (!helpId && this.getHelpId) {
                helpId = this.getHelpId();
            }
            var isLearnMoreSpecified = !_.isNil(isFromLearnMore);
            var biHelpParams = {
                component: this.props.selectedComponentType,
                learn_more: isLearnMoreSpecified ? !!isFromLearnMore : null,
                panel_name: this.props.panelName,
                origin: core.constants.BI.HELP.ORIGIN.PANEL
            };
            this.props.openHelpCenter(helpId, null, biHelpParams);
        },

        _oldAndNewValueValidation: function (oldValue, newValue) {
            return !oldValue && newValue === '';
        },

        validateMaxLength: function (maxLengthVal) {
            var reg = new RegExp('^\\d+$');
            maxLengthVal = String(maxLengthVal);
            if (this._oldAndNewValueValidation(this._getPreviousMaxLength(), maxLengthVal)) {
                return true;
            }
            var newMaxLength = parseInt(maxLengthVal, 10);
            return maxLengthVal.match(reg) && newMaxLength > 0 && newMaxLength < 1000 * 1000;
        },

        _onMaxLengthChange: function (newValue) {
            var newNumber = this.numberFromValue(newValue);
            if (_.isNumber(newNumber)) {
                this.previousValues.maxLength = newNumber;
                this.props.dataUpdate(this.props.selectedComponent, {maxLength: newNumber});
            }
        },

        numberFromValue: function (newValue) {
            if (newValue === '') {
                return null;
            }
            return Number(newValue, 10);
        },

        onMaxLengthKeyDown: function (ev) {
            var allowedKeys = ['Backspace', 'Delete', 'ArrowRight', 'ArrowLeft', 'Home'];
            var key = ev.key;
            if (/[e,\+,\-,\.]/.test(key) && !_.includes(allowedKeys, key)) {
                ev.preventDefault();
            }
        },

        statics: {
            mapEditorApiToProps_compPanelMixin: function mapEditorApiToProps_compPanelMixin(editorApi, props) {
                return {
                    layoutUpdate: editorApi.components.layout.update,
                    data: editorApi.components.data.get(props.selectedComponent),
                    properties: editorApi.components.properties.get(props.selectedComponent),
                    relativeToStructure: editorApi.components.layout.getRelativeToStructure(props.selectedComponent),
                    design: editorApi.components.design.get(props.selectedComponent),
                    isExist: editorApi.components.is.exist,
                    dataGet: editorApi.components.data.get,
                    propertiesGet: editorApi.components.properties.get,
                    layoutGetRelativeToStructure: editorApi.components.layout.getRelativeToStructure,
                    designGet: editorApi.components.design.get,
                    dataUpdate: editorApi.components.data.update,
                    designUpdate: editorApi.components.design.update,
                    propertiesUpdate: editorApi.components.properties.update,
                    selectedComponentType: editorApi.selection.getSelectedComponentType(),
                    openHelpCenter: editorApi.panelManager.openHelpCenter
                };
            }
        }
    };
});

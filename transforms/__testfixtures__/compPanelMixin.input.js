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

        var editorAPI = this.getEditorAPI();
        editorAPI.components.layout.update(this.props.selectedComponent, layout);
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
            var editorAPI = this.getEditorAPI();
            this.data = editorAPI.components.data.get(this.props.selectedComponent);
            this.properties = editorAPI.components.properties.get(this.props.selectedComponent);
            this.layout = editorAPI.components.layout.getRelativeToStructure(this.props.selectedComponent);
            this.design = editorAPI.components.design.get(this.props.selectedComponent);

            return {
                showHelp: false
            };
        },

        componentWillReceiveProps: function (nextProps) {
            var editorAPI = this.getEditorAPI();
            if (editorAPI.components.is.exist(nextProps.selectedComponent)) {
                this.data = editorAPI.components.data.get(nextProps.selectedComponent);
                this.properties = editorAPI.components.properties.get(nextProps.selectedComponent);
                this.layout = editorAPI.components.layout.getRelativeToStructure(nextProps.selectedComponent);
                this.design = editorAPI.components.design.get(nextProps.selectedComponent);
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
            var editorAPI = this.getEditorAPI();
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
                editorAPI.components.data.update(this.props.selectedComponent, newData, dontAddToUndoRedoStack);
            } else if (type === 'design') {
                editorAPI.components.design.update(this.props.selectedComponent, newData, false, dontAddToUndoRedoStack);
            } else {
                editorAPI.components.properties.update(this.props.selectedComponent, newData, dontAddToUndoRedoStack);
            }
            return newData;
        },

        openHelpCenter: function (helpId, isFromLearnMore) {
            var editorAPI = this.getEditorAPI();
            if (!helpId && this.getHelpId) {
                helpId = this.getHelpId();
            }
            var isLearnMoreSpecified = !_.isNil(isFromLearnMore);
            var biHelpParams = {
                component: editorAPI.selection.getSelectedComponentType(),
                learn_more: isLearnMoreSpecified ? !!isFromLearnMore : null,
                panel_name: this.props.panelName,
                origin: core.constants.BI.HELP.ORIGIN.PANEL
            };
            editorAPI.panelManager.openHelpCenter(helpId, null, biHelpParams);
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
                this.getEditorAPI().components.data.update(this.props.selectedComponent, {maxLength: newNumber});
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
        }
    };
});

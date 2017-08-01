define([
    'react',
    'lodash',
    'core',
    'compPanels/mixins/compPanelMixin',
    'compPanels/panels/boxSlideShow/boxSlideShowSettingsPanel.rt',
    'higherOrderComponents'
], function(React, _, core, compPanelMixin, template, higherOrderComponents) {
    'use strict';


    var BOX_SLIDE_SHOW_POSSIBLE_ANIMATIONS = [
        {
            value: 'NoTransition',
            label: 'Regular_Slideshow_Settings_Transitions_None',
            symbolName: 'transition-none'
        },
        {
            value: 'SlideVertical',
            label: 'Regular_Slideshow_Settings_Transitions_Vertical',
            symbolName: 'transition-gallery-vertical'
        },
        {
            value: 'SlideHorizontal',
            label: 'Regular_Slideshow_Settings_Transitions_Horizontal',
            symbolName: 'transition-gallery-horizontal'
        },
        {
            value: 'CrossFade',
            label: 'Regular_Slideshow_Settings_Transitions_Crossfade',
            symbolName: 'transition-gallery-crossfade'
        },
        {
            value: 'OutIn',
            label: 'Regular_Slideshow_Settings_Transitions_Outin',
            symbolName: 'transition-gallery-inout'
        }
    ];

    var ANIMATIONS_NOT_SUITABLE_FOR_OVERFLOW_HIDDEN = ['SlideVertical', 'SlideHorizontal'];

    var HORIZONTAL_TRANSITION_DIRECTIONS = [
        {
            label: 'Regular_Slideshow_Settings_Transitions_Direction_Left',
            value: 'LTR'
        },
        {
            label: 'Regular_Slideshow_Settings_Transitions_Direction_Right',
            value: 'RTL'
        }
    ];

    var VERTICAL_TRANSITION_DIRECTIONS = [
        {
            label: 'Regular_Slideshow_Settings_Transitions_Direction_Top',
            value: 'LTR'
        },
        {
            label: 'Regular_Slideshow_Settings_Transitions_Direction_Bottom',
            value: 'RTL'
        }
    ];


    var Component = React.createClass({
        displayName: 'boxSlideShowSettingsPanel',
        render: template,

        propTypes: {
            isMobileEditor: React.PropTypes.bool.isRequired,
            isDesktopEditor: React.PropTypes.bool.isRequired,
            selectedComponents: React.PropTypes.object.isRequired,
            closeAllPanels: React.PropTypes.func.isRequired,
            openComponentPanel: React.PropTypes.func.isRequired,
            propertiesUpdate: React.PropTypes.func.isRequired,
            defaultBiParams: React.PropTypes.object.isRequired,
            biEvent: React.PropTypes.func.isRequired
        },

        mixins: [compPanelMixin],

        openManageSlidesPanel: function () {
            var panelProps = {
                selectedComponent: this.props.selectedComponents
            };
            this.props.closeAllPanels();
            this.props.openComponentPanel('rEditor.panels.boxSlideShowManageSlidesPanel', panelProps);
        },

        shouldHideOverflowContentValueLink: function(){
            return {
                value: this.getProperty('shouldHideOverflowContent'),
                requestChange: this.hideOverflowContentToggeled
            };
        },

        hideOverflowContentToggeled: function (newVal) {
            var newProps = {shouldHideOverflowContent: newVal};
            if (!newVal) {
                var transition = this.getProperty('transition');
                if (_.includes(ANIMATIONS_NOT_SUITABLE_FOR_OVERFLOW_HIDDEN, transition)) {
                    newProps.transition = 'NoTransition';
                }
            } else {
                newProps.flexibleBoxHeight = false;
            }
            this.props.propertiesUpdate(this.props.selectedComponent, newProps);
        },

        getTransitions: function () {
            var boxAnimations = BOX_SLIDE_SHOW_POSSIBLE_ANIMATIONS;
            var shouldHideOverFlowContent = this.getProperty('shouldHideOverflowContent');
            if (!shouldHideOverFlowContent) {
                return _.filter(boxAnimations, function (animation) {
                    return !_.includes(ANIMATIONS_NOT_SUITABLE_FOR_OVERFLOW_HIDDEN, animation.value);
                });

            }
            return boxAnimations;
        },

        shouldShowTransitionDirection: function(){
            return _.includes(ANIMATIONS_NOT_SUITABLE_FOR_OVERFLOW_HIDDEN, this.getProperty('transition'));
        },

        shouldShowTransitionDuration: function(){
            return this.getProperty('transition') !== 'NoTransition';
        },

        getTransitionDirection: function () {
            var verticalTransition = this.getProperty('transition') === 'SlideVertical';
            return verticalTransition ? VERTICAL_TRANSITION_DIRECTIONS : HORIZONTAL_TRANSITION_DIRECTIONS;
        },

        transitionValueLink: function(){
            var baseValueLink = this.linkedProperty('transition');
            return {
                value: baseValueLink.value,
                requestChange: function(newVal){
                    baseValueLink.requestChange(newVal);
                    var biParams = _.assign({transition: newVal}, this.props.defaultBiParams);
                    this.props.biEvent(core.bi.events.boxSlideShow.SETTINGS_TRANSITION_SELECTED, biParams);
                }.bind(this)
            };
        },

        directionValueLink: function(){
            var baseValueLink = this.linkedProperty('direction');
            return {
                value: baseValueLink.value,
                requestChange: function(newVal){
                    baseValueLink.requestChange(newVal);
                    var biParams = _.assign({direction: newVal}, this.props.defaultBiParams);
                    this.props.biEvent(core.bi.events.boxSlideShow.SETTINGS_TRANSITION_DIRECTION_SELECTED, biParams);
                }.bind(this)
            };
        }
    });

    function mapEditorApiToProps(editorApi, props) {
        return {
            isMobileEditor: editorApi.isMobileEditor(),
            isDesktopEditor: editorApi.isDesktopEditor(),
            selectedComponents: editorApi.selection.getSelectedComponents(),
            closeAllPanels: editorApi.panelManager.closeAllPanels,
            openComponentPanel: editorApi.panelManager.openComponentPanel,
            propertiesUpdate: editorApi.components.properties.update,
            defaultBiParams: editorApi.components.getDefaultBiParams(props.selectedComponent[0]),
            biEvent: editorApi.bi.event
        };
    }

    var ConnectedComponent = higherOrderComponents.connectEditorAPI(mapEditorApiToProps)(Component);

    ConnectedComponent.pure = Component;

    return ConnectedComponent;
});

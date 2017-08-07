define([
    'lodash',
    'react',
    'baseUI',
    'rEditor/rootComps/overlay/overlayWithHole',
    'rEditor/rootComps/overlay/overlayWithQuickTip'
], function(
    _,
    React,
    baseUI,
    OverlayWithHoleClass,
    OverlayWithQuickTipClass
){
    'use strict';

    function getQuickTipProps(editorAPI) {
        return {
            delayBeforeShow: 500,
            delayBeforeNext: 1500,
            quickTipSession: {
                id: 'popupOverlayQuickTipShownFor-',
                maxNum: 4
            },
            shouldNotHideOnMouseLeaveTarget: false,
            templateInfo: {
                text: 'POPUPS_OVERLAY_HOVER_TOOLTIP',
                symbol: 'idea-bulb'
            },
            propsForBubble: {
                noArrow: true,
                shake: false,
                behindPopUps: true,
                alignment: baseUI.uiConstants.TOOLTIP.ALIGNMENT.RIGHT,
                closeTriggers: [baseUI.uiConstants.TOOLTIP.TRIGGERS.CLICK],
                onMouseLeave: editorAPI.overlay.enableUpdate,
                onMouseEnter: editorAPI.overlay.disableUpdate
            }
        };
    }

    return {
        pinnable: false,

        shouldBeOverlayed: function(editorAPI, compRef) {
            return !editorAPI.isMobileEditor() && editorAPI.documentServices.pages.popupPages.isPopup(compRef.id);
        },

        getOverlay: function(editorAPI, compRef) {
            var overlayWithHole = React.createElement(OverlayWithHoleClass, {
                hole: editorAPI.pages.popupPages.getPopupContainer(),
                background: 'rgba(127, 204, 247, 0.4)'
            });

            var overlayWithQuickTip = React.createElement(
                OverlayWithQuickTipClass,
                _.assign({hoveredComp: compRef}, getQuickTipProps(editorAPI)),
                overlayWithHole
            );

            return overlayWithQuickTip;
        },

        getOverlayProperties: function() {
            return {
                enter: {
                    duration: 300,
                    delay: 500
                },
                leave: {
                    duration: 300
                }
            };
        }

    };
});

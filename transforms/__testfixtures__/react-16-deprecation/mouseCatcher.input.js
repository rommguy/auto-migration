define([
    'reactDOM',
    'react',
    'jquery',
    'lodash',
    'rEditor/rootComps/mouseCatcher.rt',
    'core',
    'util',
    'rEditor/utils/mouseMoveActions/baseDrag',
    'rEditor/utils/mouseMoveActions/dragAttempt',
    'rEditor/utils/lassoMouseMoveActions/lassoDrag'
], function(
    ReactDOM,
    React,
    $,
    _,
    template,
    core,
    util,
    baseDrag,
    dragAttempt,
    lassoDrag
) {
    'use strict';

    var FORBIDDEN_COMP_TYPES_TO_HOVER = [
        'wysiwyg.viewer.components.PagesContainer',
        'wysiwyg.viewer.components.PageGroup',
        'wysiwyg.common.components.anchor.viewer.Anchor'
    ];
    var mouseCoordinatesHandler = core.utils.mouseCoordinatesHandler;

    function getDragStrategy(editorAPI, compPointer) {

        if (!canBeDragged(editorAPI, compPointer)) {
            return dragAttempt;
        }
        return baseDrag;
    }

    var LEFT_BUTTON_JQUERY = 1;

    function canBeDragged(editorAPI, selectedComp) {
        var compRestriction = editorAPI.getCompDragRestrictions(selectedComp);
        return (compRestriction.horizontallyMovable || compRestriction.verticallyMovable);
    }

    function isMouseAboveSelectedComponents(editorAPI, e) {
        var compUnderMouse = editorAPI.selection.getComponentUnderClickToBeSelected(e.clientX, e.clientY);
        return editorAPI.selection.isComponentSelected(compUnderMouse);
    }


    function isValidCompToHover(editorAPI, comp) {
        if (!editorAPI.components.is.exist(comp)) {
            return false;
        }
        var selectedComp = editorAPI.selection.getSelectedComponents();
        var compType = editorAPI.components.getType(comp);

        return (!editorAPI.selection.isComponentSelected(comp) || editorAPI.multiselect.isMultiselect(selectedComp)) && !_.includes(FORBIDDEN_COMP_TYPES_TO_HOVER, compType);
    }

    function isLassoActivated(editorAPI) {
        return !!editorAPI.store.getState().lassoLayout;
    }

    function getCompToBeDragged(editorAPI, selectedComponents) {
        var isControlledByParent = editorAPI.components.is.controlledByParent;

        return _(selectedComponents)
            .map(function (compRef) {
                return isControlledByParent(compRef) ?
                    editorAPI.utils.findAncestorMatchesCondition(compRef, _.negate(isControlledByParent)) : compRef;
            })
            .thru(editorAPI.multiselect.getComponentsWhichDontHaveAncestorsInTheArray)
            .value();
    }

    return React.createClass({
        displayName: 'mouseCatcher',
        mixins: [core.mixins.editorAPIMixin],
        propTypes: {
            selectedComponents: React.PropTypes.oneOfType([React.PropTypes.object, React.PropTypes.arrayOf(React.PropTypes.object)]),
            focusedContainer: React.PropTypes.object,
            config: React.PropTypes.object,
            onContextMenu: React.PropTypes.func,
            performingMouseMoveAction: React.PropTypes.bool,
            hoveredComp: React.PropTypes.object,
            isDragging: React.PropTypes.bool,
            isResizing: React.PropTypes.bool,
            isRotating: React.PropTypes.bool,
            isPinMode: React.PropTypes.bool,
            compPanel: React.PropTypes.object,
            editingAreaLayout: React.PropTypes.object,
            previewPosition: React.PropTypes.object,
            previewMode: React.PropTypes.bool.isRequired,
            attachCandidate: React.PropTypes.object,
            snapData: React.PropTypes.array,
            applyModeFromClipboardSuggestion: React.PropTypes.object,
            tabIndicationState: React.PropTypes.object.isRequired,
            lastSelectionClickPos: React.PropTypes.object,
            lassoCandidates: React.PropTypes.array,
            lassoLayout: React.PropTypes.object,
            constraintArea: React.PropTypes.object
        },
        componentWillMount: function () {
            this.compsBeforeSelection = null;
            this.shouldStartDragging = false;
            this.shouldStartLasso = false;
            this.initMousePosition = null;
            this.isWaitingForUpdate = false;
        },

        componentDidMount: function () {
            $(ReactDOM.findDOMNode(this)).on('mouseenter', this.onMouseEnter);
        },

        componentWillUnmount: function () {
            $(ReactDOM.findDOMNode(this)).off('mouseenter', this.onMouseEnter);
        },

        componentWillReceiveProps: function (nextProps) {
            var editorAPI = this.getEditorAPI();
            var dragStrategy = getDragStrategy(editorAPI, nextProps.selectedComponents);
            if (this.shouldStartDragging && dragStrategy) {
                var compsToBeDragged = getCompToBeDragged(editorAPI, nextProps.selectedComponents);
                editorAPI.mouseActions.registerMouseMoveAction(dragStrategy, {
                    initMousePosition: this.initMousePosition,
                    selectedComp: compsToBeDragged
                });
            } else if (this.shouldStartLasso) {
                editorAPI.mouseActions.registerMouseMoveAction(lassoDrag, {
                    initMousePosition: this.initMousePosition,
                    prevSelectedComps: this.compsBeforeSelection,
                    selectedComponents: nextProps.selectedComponents
                });
            }

            this.shouldStartDragging = false;
            this.shouldStartLasso = false;
        },

        onMouseDown: function (event) {
            var editorAPI = this.getEditorAPI();
            util.keyboardShortcuts.enable();

            var mouseCoordinates = mouseCoordinatesHandler.fitMouseCoordinatesToViewer(editorAPI, event);

            this.initMousePosition = {
                x: mouseCoordinates.pageX,
                y: mouseCoordinates.pageY,
                isShiftPressed: event.shiftKey,
                isSpecialKeyPressed: util.browserUtil.isSpecialKeyPressed(event),
                isAltKeyPressed: event.altKey
            };

            this.shouldStartLasso = editorAPI.mouseActions.shouldInitLassoToolOnMouseDown(event);
            this.shouldStartDragging = !this.shouldStartLasso && (!editorAPI.selection.isMultiSelectKeyPressed(event) || isMouseAboveSelectedComponents(editorAPI, event));

            if (editorAPI.selection.isHiddenComponentDraggedNext()) {
                editorAPI.selection.setIsHiddenComponentDraggedNext(false);
            } else if (!isLassoActivated(editorAPI)) {
                this.compsBeforeSelection = this.props.selectedComponents;
                editorAPI.selection.selectComponentByClick(event);
                this.shouldStartDragging = this.shouldStartDragging && editorAPI.selection.isComponentExplicitlySelected();
            }


            editorAPI.closeRightClickMenu();
            editorAPI.panelManager.notifyMouseDown();
        },

        onMouseUp: function (e) {
            var editorAPI = this.getEditorAPI();

            var isRightClick = (e.button === 2);

            if (!isRightClick) {
                this.deselectClickedCompIfNeeded(e);

                if (editorAPI.selection.getIsMouseUpSelectionEnabled() && !isLassoActivated(editorAPI)) {
                    editorAPI.selection.selectNonGroupCompUnderCursor(e, this.props.siteScale);
                }
            }

            editorAPI.selection.setIsMouseUpSelectionEnabled(false);
            this.initMousePosition = null;
            this.shouldStartDragging = false;
            this.shouldStartLasso = false;
        },

        onMouseMove: function (event) {
            var editorAPI = this.getEditorAPI();
            var mouseCoordinates = mouseCoordinatesHandler.fitMouseCoordinatesToViewer(editorAPI, event);

            if (!this.props.registeredMouseMoveAction) {
                this.updateHoverBox(event);
            }

            editorAPI.cursor.updateMousePosition(mouseCoordinates.pageX, mouseCoordinates.pageY);
        },

        onMouseEnter: function (e) {
            if (e.which !== LEFT_BUTTON_JQUERY) {
                this.getEditorAPI().endMouseMoveActionIfNeeded(_.clone(e));
            }
        },

        updateHoverBox: function (e) {
            if (this.isWaitingForUpdate) {
                return;
            }
            this.isWaitingForUpdate = true;

            var editorAPI = this.getEditorAPI();
            e.persist();

            editorAPI.documentServices.waitForChangesApplied(function () {
                this.isWaitingForUpdate = false;

                var hoveredComp = editorAPI.selection.getComponentToBeMarkedByHoverBox(e, this.shouldStartDragging);
                var hoverBoxOverlay = this.props.hoverBoxOverlay;

                if (!this.props.hoveredComp && hoveredComp) {
                    if (isValidCompToHover(editorAPI, hoveredComp)) {
                        this.props.setHoverBox(hoveredComp, hoverBoxOverlay);
                    }
                } else if (this.props.hoveredComp && !hoveredComp) {
                    this.props.clearHoverBox();
                } else if (this.props.hoveredComp && hoveredComp) {
                    if (!isValidCompToHover(editorAPI, hoveredComp)) {
                        this.props.clearHoverBox();
                    } else if (this.props.hoveredComp.id !== hoveredComp.id) {
                        this.props.setHoverBox(hoveredComp, hoverBoxOverlay);
                    }
                }
            }.bind(this));
        },

        clearHoverBox: function () {
            this.props.clearHoverBox();
        },

        deselectClickedCompIfNeeded: function (event) {
            var editorAPI = this.getEditorAPI();

            if (editorAPI.selection.isMultiSelectKeyPressed(event) && this.initMousePosition) {
                var clickedComp = editorAPI.selection.getComponentUnderClickToBeSelected(event);
                var wasCompSelectedBeforeClick = !!_.find(this.compsBeforeSelection, clickedComp);
                var mouseCoordinates = mouseCoordinatesHandler.fitMouseCoordinatesToViewer(editorAPI, event);
                var wasMouseStill = !this.isPointsDistanceBiggerThan(this.initMousePosition, {
                    x: mouseCoordinates.pageX,
                    y: mouseCoordinates.pageY
                }, 2);
                if (wasCompSelectedBeforeClick && wasMouseStill) {
                    editorAPI.selection.setIsMouseUpSelectionEnabled(false);
                    editorAPI.selection.deselectComponents(clickedComp);
                }
            }
        },

        isPointsDistanceBiggerThan: function (point1, point2, distance) {
            var pointsDistanceSquare = Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2);
            return Math.sqrt(pointsDistanceSquare) > distance;
        },

        isComponentSelected: function () {
            return this.getEditorAPI().selection.isComponentSelected();
        },

        getComponentLabel: function () {
            return this.getEditorAPI().getComponentType(this.props.selectedComponents);
        },

        isCompDraggable: function () {
            var editorAPI = this.getEditorAPI();
            var hoveredComp = this.props.hoveredComp;

            if (hoveredComp) {
                return isValidCompToHover(editorAPI, hoveredComp) && editorAPI.components.is.draggable(hoveredComp);
            }

            return false;
        },

        getCompToShowMarginsIndicator: function () {
            var editorAPI = this.getEditorAPI();
            if (this.props.attachCandidate) {
                return this.props.attachCandidate;
            }
            if (this.props.isDragging) {
                return editorAPI.components.getContainer(this.getEditorAPI().selection.getSelectedComponents());
            }
            return null;
        },

        showMarginsIndicator: function () {
            var editorAPI = this.getEditorAPI();
            var compPointer = this.getCompToShowMarginsIndicator();
            return compPointer && editorAPI.components.is.showMarginsIndicator(compPointer);
        },

        getMarginsIndicatorStyles: function (compPointer) {
            var editorAPI = this.getEditorAPI();
            var relativeToScreen = editorAPI.components.layout.getRelativeToScreen(compPointer);
            var compMargin = editorAPI.components.layout.getCompMargin(compPointer);

            return {
                indicator: {
                    top: relativeToScreen.y,
                    left: relativeToScreen.x,
                    width: relativeToScreen.width,
                    height: relativeToScreen.height
                },
                marginLeft: Math.max(0, compMargin.left),
                marginRight: Math.max(0, compMargin.right),
                inlineWidth: relativeToScreen.width - _.sum(compMargin)
            };
        },

        render: template
    });
});

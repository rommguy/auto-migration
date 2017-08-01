define([
    'reactDOM',
    'react',
    'jquery',
    'lodash',
    'core',
    'util',
    'compPanels/mixins/compPanelMixin',
    'compPanels/panels/anchorsMenu/anchorsMenuManagePanel.rt'
], function (ReactDOM, React, $, _, core, util, compPanelMixin, template) {

    'use strict';

    var PAGE_TOP_ANCHOR_ID = 'PAGE_TOP_ANCHOR';

    function getAnchorDef(editorAPI) {
        return {
            componentType: 'wysiwyg.common.components.anchor.viewer.Anchor',
            skin: 'wysiwyg.common.components.anchor.viewer.skins.AnchorSkin',
            styleId: 'Anchor_1',
            data: editorAPI.data.createItem('Anchor'),
            type: 'Component'
        };
    }

    function getAllAnchorsInPage(editorAPI, page) {
        var anchors = null;
        if (page) {
            var pageTopLabel = getAnchorsMenuPageTopLabel(editorAPI);
            anchors = editorAPI.pages.anchors.getPageAnchors(page.id, pageTopLabel);
        }
        return anchors;
    }

    function getAnchorsMenuPageTopLabel(editorAPI) {
        var selectedAnchorsMenu = editorAPI.selection.getSelectedComponents();
        var anchorsMenuDataItem = editorAPI.components.data.get(selectedAnchorsMenu);
        return (anchorsMenuDataItem && anchorsMenuDataItem.pageTopLabel) || null;
    }

    function getHiddenAnchorIds(editorAPI, anchorMenuComp, page) {
        var anchorsMenuDataItem = editorAPI.components.data.get(anchorMenuComp);
        return (anchorsMenuDataItem.hiddenAnchorIds && anchorsMenuDataItem.hiddenAnchorIds[page.id]) || null;
    }

    function cleanupNonExistingPageAnchors(editorAPI, anchorMenuComp, allAnchorsInPage, hiddenAnchorsInPage) {
        var existingHiddenAnchorsInPage = getExistingHiddenAnchorsOnPage(allAnchorsInPage, hiddenAnchorsInPage);
        if (!_.isEqual(existingHiddenAnchorsInPage, hiddenAnchorsInPage)) {
            updateHiddenAnchorsOnPage(editorAPI, anchorMenuComp, existingHiddenAnchorsInPage);
        }
    }

    function getExistingHiddenAnchorsOnPage(allAnchorsInPage, hiddenAnchorsInPage) {
        var allAnchorsIdsInPage = _.map(allAnchorsInPage, 'compId');
        return _.filter(hiddenAnchorsInPage, function (anchorId) {
            return _.includes(allAnchorsIdsInPage, anchorId);
        });
    }

    function updateHiddenAnchorsOnPage(editorAPI, anchorMenuComp, hiddenAnchors) {
        var anchorsMenuDataItem = editorAPI.components.data.get(anchorMenuComp);
        var currentPageId = editorAPI.documentServices.pages.getPrimaryPageId();
        anchorsMenuDataItem.hiddenAnchorIds = anchorsMenuDataItem.hiddenAnchorIds || {};
        anchorsMenuDataItem.hiddenAnchorIds[currentPageId] = hiddenAnchors;
        editorAPI.components.data.update(anchorMenuComp, anchorsMenuDataItem);
    }

    function getNonHiddenAnchorsInPage(allAnchorsInPage, hiddenAnchors) {
        if (_.size(allAnchorsInPage) <= 1) {
            hiddenAnchors = null;
        }

        var nonHiddenAnchorsInPage = _.compact(_.map(allAnchorsInPage, function (anchor) {
            var isAnchorShowing = !_.includes(hiddenAnchors, anchor.compId);
            return createAnchorItem(anchor, isAnchorShowing);
        }));

        if (!_.isEmpty(nonHiddenAnchorsInPage) &&
            _(nonHiddenAnchorsInPage).filter('isShowing').size() === 0) {
            nonHiddenAnchorsInPage[0].isShowing = true;
        }
        return nonHiddenAnchorsInPage;
    }

    function createAnchorItem(anchor, isShowing) {
        var anchorItem = null;
        if (anchor) {
            anchorItem = {
                compId: anchor.compId,
                name: anchor.name,
                isShowing: isShowing
            };
        }
        return anchorItem;
    }

    function toggleAnchorDataItem(editorAPI, anchorMenuRef, anchorItem) {
        var anchorsMenuDataItem = editorAPI.components.data.get(anchorMenuRef);
        if (anchorItem) {
            var currentPageId = editorAPI.documentServices.pages.getPrimaryPageId();
            toggleShowingAnchorInDataItem(anchorItem, anchorsMenuDataItem, currentPageId);
            editorAPI.components.data.update(anchorMenuRef, anchorsMenuDataItem);
        }
    }

    function toggleShowingAnchorInDataItem(anchor, dataItem, pageId) {
        var isAnchorHidden = _.includes(dataItem.hiddenAnchorIds[pageId], anchor.compId);
        if (isAnchorHidden) {
            dataItem.hiddenAnchorIds[pageId] = _.without(dataItem.hiddenAnchorIds[pageId], anchor.compId);
        } else {
            dataItem.hiddenAnchorIds[pageId] = dataItem.hiddenAnchorIds[pageId] || [];
            dataItem.hiddenAnchorIds[pageId].push(anchor.compId);
        }
    }

    function isPageTopAnchor(anchorCompId) {
        return anchorCompId === PAGE_TOP_ANCHOR_ID;
    }

    function renamePageTopAnchor(editorAPI, componentPointer, anchorLabel) {
        var dataItem = editorAPI.components.data.get(componentPointer);
        dataItem.pageTopLabel = anchorLabel;
        editorAPI.components.data.update(componentPointer, dataItem);
    }

    function renameExistingAnchor(editorAPI, anchorCompId, anchorLabel) {
        var componentPointer = editorAPI.components.get.byId(anchorCompId);
        var dataItem = editorAPI.components.data.get(componentPointer);
        dataItem.name = anchorLabel;
        editorAPI.components.data.update(componentPointer, dataItem);
    }

    function renameLastFocusedAnchor(panel, editorAPI) {
        if (panel.lastFocusedAnchorCompId) {
            var lastFocusedAnchorTextInput = ReactDOM.findDOMNode(panel.refs[panel.lastFocusedAnchorCompId]);
            var anchorLabel = $(lastFocusedAnchorTextInput).find('input').val();
            setAnchorName(editorAPI, panel.props.selectedComponent, panel.lastFocusedAnchorCompId, anchorLabel);
            panel.lastFocusedAnchorCompId = null;
        }
    }

    function setAnchorName(editorAPI, anchorsMenu, anchorCompId, label) {
        if (isPageTopAnchor(anchorCompId)) {
            renamePageTopAnchor(editorAPI, anchorsMenu, label);
        } else {
            renameExistingAnchor(editorAPI, anchorCompId, label);
        }
    }

    return React.createClass({
        displayName: 'AnchorsMenuManagePanel',
        mixins: [compPanelMixin, util.translationMixin],
        getInitialState: function () {
            this.lastFocusedAnchorCompId = null;
            var anchorsList = this.getAnchorsList();
            return {
                anchorList: anchorsList
            };
        },

        componentWillReceiveProps: function () {
            var anchorsList = this.getAnchorsList();
            this.setState({
                anchorList: anchorsList
            });
        },

        componentWillUnmount: function () {
            renameLastFocusedAnchor(this, this.getEditorAPI());
        },

        getNewAnchorLayout: function () {
            var editorAPI = this.getEditorAPI();
            var anchorsMenuLayout = editorAPI.components.layout.getRelativeToStructure(this.props.selectedComponent);
            var pageTop = editorAPI.components.layout.getRelativeToStructure(editorAPI.documentServices.siteSegments.getPagesContainer()).y;
            var newAnchorPos = anchorsMenuLayout.y + anchorsMenuLayout.height - pageTop + core.constants.ANCHORS_MENU.NEW_ANCHOR_POS_MARGIN;

            if (anchorsMenuLayout.fixedPosition) {
                var siteScroll = editorAPI.site.getScroll().y;
                newAnchorPos += siteScroll;
            }

            return {
                y: newAnchorPos
            };
        },

        addAnchor: function () {
            var editorAPI = this.getEditorAPI();
            var anchorDef = getAnchorDef(editorAPI);
            var anchorLayout = this.getNewAnchorLayout();
            var currentPagePointer = editorAPI.documentServices.pages.getReference(editorAPI.documentServices.pages.getPrimaryPageId());

            anchorDef.layout = anchorLayout;

            editorAPI.components.add(currentPagePointer, anchorDef, null, function () {
                editorAPI.history.add('added anchor');
            });

        },

        getAnchorsList: function () {
            var editorAPI = this.getEditorAPI();
            var currentPagePointer = editorAPI.documentServices.pages.getReference(editorAPI.documentServices.pages.getPrimaryPageId());
            var allAnchorsInPage = getAllAnchorsInPage(editorAPI, currentPagePointer);
            var hiddenAnchors = getHiddenAnchorIds(editorAPI, this.props.selectedComponent, currentPagePointer);
            cleanupNonExistingPageAnchors(editorAPI, this.props.selectedComponent, allAnchorsInPage, hiddenAnchors);
            return getNonHiddenAnchorsInPage(allAnchorsInPage, hiddenAnchors);
        },

        onAnchorShowToggle: function (itemIndex) {
            if (this.state.anchorList) {
                var editorAPI = this.getEditorAPI();
                var anchorItem = this.state.anchorList[itemIndex];
                anchorItem.isShowing = !anchorItem.isShowing;
                toggleAnchorDataItem(editorAPI, this.props.selectedComponent, anchorItem);
                this.setState({
                    anchorList: this.state.anchorList
                });
            }
        },

        getNumberOfEnabledAnchors: function (anchorsList) {
            return _(anchorsList).map('isShowing').filter().size();
        },

        setFocusedItem: function (anchorCompId) {
            this.lastFocusedAnchorCompId = anchorCompId;
        },

        renameAnchor: function (anchorCompId, event, isCanceled) {
            if (!isCanceled) {
                var anchorLabel = event.target.value || '';
                setAnchorName(this.getEditorAPI(), this.props.selectedComponent, anchorCompId, anchorLabel);
            }
        },

        render: template
    });
});

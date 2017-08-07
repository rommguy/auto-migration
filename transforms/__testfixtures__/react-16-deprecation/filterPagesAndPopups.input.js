define([
    'react',
    'core',
    'lodash',
    'rEditor/pagesMenu/specialPagesMenuMixin',
    'rEditor/pagesMenu/filterPagesAndPopups/filterPagesAndPopups.rt'
], function (
    React,
    core,
    _,
    specialPagesMenuMixin,
    template
) {
    'use strict';

    return React.createClass({
        displayName: 'filterPagesAndPopups',

        mixins: [React.addons.LinkedStateMixin, specialPagesMenuMixin],

        propTypes: {
            popupsList: React.PropTypes.array.isRequired,
            menuItemsList: React.PropTypes.array.isRequired,
            openSettingsPanel: React.PropTypes.func.isRequired,
            closeSettingsPanel: React.PropTypes.func.isRequired,
            openSpecialPageMenu: React.PropTypes.func.isRequired,
            closeSpecialPageMenu: React.PropTypes.func.isRequired,
            isSectionPage: React.PropTypes.func.isRequired,
            editedItemIdLink: React.PropTypes.object.isRequired,
            selectedItemInfoLink: React.PropTypes.object.isRequired,
            changeSelectedMenuItem: React.PropTypes.func.isRequired
        },

        isHasSomeItems: function () {
            return this.props.menuItemsList.length !== 0 || this.props.popupsList.length !== 0;
        },

        getProps: function () {
            return _.assign({}, this.props, {
                openSectionPageMenu: this.openSpecialPagesMenu
            });
        },

        render: template
    });
});

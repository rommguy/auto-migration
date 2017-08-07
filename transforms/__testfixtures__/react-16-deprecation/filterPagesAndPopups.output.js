define([
    'react',
    'create-react-class',
    'prop-types',
    'core',
    'lodash',
    'rEditor/pagesMenu/specialPagesMenuMixin',
    'rEditor/pagesMenu/filterPagesAndPopups/filterPagesAndPopups.rt'
], function(
    React,
    createReactClass,
    PropTypes,
    core,
    _,
    specialPagesMenuMixin,
    template
) {
    'use strict';

    return createReactClass({
        displayName: 'filterPagesAndPopups',

        mixins: [React.addons.LinkedStateMixin, specialPagesMenuMixin],

        propTypes: {
            popupsList: PropTypes.array.isRequired,
            menuItemsList: PropTypes.array.isRequired,
            openSettingsPanel: PropTypes.func.isRequired,
            closeSettingsPanel: PropTypes.func.isRequired,
            openSpecialPageMenu: PropTypes.func.isRequired,
            closeSpecialPageMenu: PropTypes.func.isRequired,
            isSectionPage: PropTypes.func.isRequired,
            editedItemIdLink: PropTypes.object.isRequired,
            selectedItemInfoLink: PropTypes.object.isRequired,
            changeSelectedMenuItem: PropTypes.func.isRequired
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

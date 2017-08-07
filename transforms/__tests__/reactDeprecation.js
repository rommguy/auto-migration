'use strict';

const defineTest = require('jscodeshift/dist/testUtils').defineTest;
defineTest(__dirname, 'reactDeprecation', {}, 'react-16-deprecation/mouseCatcher');
defineTest(__dirname, 'reactDeprecation', {}, 'react-16-deprecation/popupOverlay');
defineTest(__dirname, 'reactDeprecation', {}, 'react-16-deprecation/filterPagesAndPopups');
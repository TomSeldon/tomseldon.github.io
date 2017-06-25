const tippy = require('tippy.js/dist/tippy');

require('tippy.js/dist/tippy.css')

export const addTooltipsToHomeIcons = () => {
    tippy('.home__icon', {
        interactive: true,
        performance: true,
        position: 'bottom'
    });
};

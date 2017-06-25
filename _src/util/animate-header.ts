export const animateHeader = () => {
    const heading = document.getElementById('name');

    if (!heading) {
        return;
    }

    const letters = heading.innerHTML.split('');

    // Wrap letters in spans, allowing them to be styled individually
    const wrappedHeading = letters.map(letter => {
        return `<span class="fancy letter">${letter}</span>`;
    });

    heading.innerHTML = wrappedHeading.join('');
};

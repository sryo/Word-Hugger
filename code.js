figma.skipInvisibleInstanceChildren = true;

if (figma.currentPage) {
    const adjustSpaces = (text) => {
        // Extract words considering both spaces and non-breaking spaces
        const words = text.match(/[^ \u00A0]+/g);
        
        if (!words || words.length <= 2) {
            return text;
        }
        
        // Determine the position of the second last word
        const secondLastWordPosition = text.lastIndexOf(words[words.length - 2]);
    
        // Determine the start of the last word (second last word length + its start position + 1 for the space)
        const lastSpaceIndex = secondLastWordPosition + words[words.length - 2].length;
        
        if (lastSpaceIndex !== -1 && text.charAt(lastSpaceIndex) === ' ') {
            text = text.slice(0, lastSpaceIndex) + '\u00A0' + text.slice(lastSpaceIndex + 1);
        }
    
        return text;
    };    

    let textNodes = [];

    if (figma.currentPage.selection.length > 0) {
        figma.currentPage.selection.forEach(selectedNode => {
            if (selectedNode.type === "TEXT") {
                textNodes.push(selectedNode);
            } else if (typeof selectedNode.findAll === "function") {
                const selectedTextNodes = selectedNode.findAll(node => node.type === "TEXT");
                textNodes = textNodes.concat(selectedTextNodes);
            }
        });
    } else {
        textNodes = figma.currentPage.findAll(node => node.type === "TEXT");
    }

    const validTextNodes = textNodes.filter(textNode => textNode.fontName && textNode.fontName.family && textNode.fontName.style);
    const loadFontsPromises = validTextNodes.map(textNode => figma.loadFontAsync({ family: textNode.fontName.family, style: textNode.fontName.style }));

    let totalOrphansAdjusted = 0;

    Promise.all(loadFontsPromises).then(() => {
        textNodes.forEach(textNode => {
            const paragraphs = textNode.characters.split('\n');
            const adjustedParagraphs = paragraphs.map(adjustSpaces);

            for (let i = 0; i < paragraphs.length; i++) {
                if (paragraphs[i] !== adjustedParagraphs[i]) {
                    totalOrphansAdjusted++;
                }
            }

            if (JSON.stringify(paragraphs) !== JSON.stringify(adjustedParagraphs)) {
                const originalSegments = textNode.getStyledTextSegments(["fontSize", "fontName", "fontWeight", "textCase", "textDecoration", "letterSpacing", "lineHeight", "hyperlink", "fills", "textStyleId", "fillStyleId", "listOptions", "indentation"]);

                let finalText = '';
                let finalSegments = [];

                adjustedParagraphs.forEach((paragraph, idx) => {
                    finalText += paragraph + (idx < adjustedParagraphs.length - 1 ? '\n' : '');
                    const paragraphStart = finalText.length - paragraph.length;
                    const paragraphEnd = finalText.length;

                    const paragraphSegments = originalSegments.filter(segment => segment.start >= paragraphStart && segment.end <= paragraphEnd);

                    paragraphSegments.forEach(segment => {
                        const newSegment = {};
                        for (const prop in segment) {
                            if (segment.hasOwnProperty(prop)) {
                                newSegment[prop] = segment[prop];
                            }
                        }
                        finalSegments.push(newSegment);
                    });
                });

                textNode.characters = finalText;
                finalSegments.forEach(segment => {
                    for (const key in segment) {
                        if (key !== 'start' && key !== 'end' && key !== 'characters' && textNode[`setRange${key.charAt(0).toUpperCase() + key.slice(1)}`]) {
                            textNode[`setRange${key.charAt(0).toUpperCase() + key.slice(1)}`](segment.start, segment.end, segment[key]);
                        }
                    }
                });
            }
        });

        figma.currentPage.setRelaunchData({ adjustSpaces: 'Click to hug words in this page.' });
        figma.notify(`Hugged ${totalOrphansAdjusted} words (つ ᵕ ᴗ ᵕ )つ(◡ ‿ ◡  )`);
        figma.closePlugin();

    }).catch(error => {
        figma.notify('An error occurred: ' + error.message);
        figma.closePlugin();
    });
}

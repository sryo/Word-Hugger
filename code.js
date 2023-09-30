figma.skipInvisibleInstanceChildren = true;

if (figma.currentPage) {

    const hugLastWordInLine = (text) => {
        const words = text.match(/[^ \u00A0]+/g);
        
        if (!words || words.length <= 2) return text;

        const secondLastWordPosition = text.lastIndexOf(words[words.length - 2]);
        const lastSpaceIndex = secondLastWordPosition + words[words.length - 2].length;
        
        if (text.charAt(lastSpaceIndex) === ' ') {
            return text.slice(0, lastSpaceIndex) + '\u00A0' + text.slice(lastSpaceIndex + 1);
        }
    
        return text;
    };

    const collectTextNodes = () => {
        let nodes = [];

        if (figma.currentPage.selection.length > 0) {
            figma.currentPage.selection.forEach(selectedNode => {
                if (selectedNode.type === "TEXT") {
                    nodes.push(selectedNode);
                } else if (typeof selectedNode.findAll === "function") {
                    nodes = nodes.concat(selectedNode.findAll(node => node.type === "TEXT"));
                }
            });
        } else {
            nodes = figma.currentPage.findAll(node => node.type === "TEXT");
        }

        return nodes;
    };

    const processOrphanLines = (textNodes) => {
        let totalOrphanLinesHugged = 0;

        textNodes.forEach(textNode => {
            const paragraphs = textNode.characters.split('\n');
            const huggedParagraphs = paragraphs.map(hugLastWordInLine);

            for (let i = 0; i < paragraphs.length; i++) {
                if (paragraphs[i] !== huggedParagraphs[i]) {
                    totalOrphanLinesHugged++;
                }
            }

            if (JSON.stringify(paragraphs) !== JSON.stringify(huggedParagraphs)) {
                const originalSegments = textNode.getStyledTextSegments(["fontSize", "fontName", "fontWeight", "textCase", "textDecoration", "letterSpacing", "lineHeight", "hyperlink", "fills", "textStyleId", "fillStyleId", "listOptions", "indentation"]);

                let finalText = '';
                let finalSegments = [];

                huggedParagraphs.forEach((paragraph, idx) => {
                    finalText += paragraph + (idx < huggedParagraphs.length - 1 ? '\n' : '');
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

        figma.currentPage.setRelaunchData({ hugWords: 'Click to hug orphan lines in this page.' });
        figma.notify(`Hugged ${totalOrphanLinesHugged} orphan lines (つ ᵕ ᴗ ᵕ )つ(◡ ‿ ◡  )`);
        figma.closePlugin();
    };

    const textNodes = collectTextNodes();
    const validTextNodes = textNodes.filter(textNode => textNode.fontName && textNode.fontName.family && textNode.fontName.style);
    const loadFontsPromises = validTextNodes.map(textNode => figma.loadFontAsync({ family: textNode.fontName.family, style: textNode.fontName.style }));

    Promise.all(loadFontsPromises)
        .then(() => processOrphanLines(textNodes))
        .catch(error => {
            figma.notify('An error occurred: ' + error.message);
            figma.closePlugin();
        });
}

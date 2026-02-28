import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Parse a PDF file and extract text content
 * @param {File} file - The PDF file to parse
 * @returns {Promise<{text: string, pages: number, title: string}>}
 */
export async function parsePdf(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    // Try to extract title from first few lines
    const lines = fullText.split('\n').filter(l => l.trim().length > 0);
    const title = lines[0]?.trim().substring(0, 120) || file.name.replace('.pdf', '');

    return {
        text: fullText.trim(),
        pages: totalPages,
        title,
        fileName: file.name,
        fileSize: file.size,
    };
}

# Centre documents

Open **Documents** in the dashboard menu. The active centre determines which folder you see. In Combined View, choose a centre folder first. Switching the active centre switches the document folder too.

## View and download

Use **Open PDF** to view a file in a new browser tab, or **Download** to save a copy. Access requires signing in and having permission for that centre. The page shows the document name, original filename, size and last update date.

## Manage files

Owners can manage all centres in their organisation. Managers can manage documents at centres where they hold a manager assignment. Other authorised staff can view and download files at their assigned centres.

- **Upload PDF:** give the document a recognisable name, choose its PDF, then select Upload PDF in the form.
- **Rename:** change the displayed document name without replacing its PDF.
- **Replace PDF:** select a new PDF and save. The existing PDF remains available until the replacement is saved. A replacement overwrites the previous file; it is not a version archive.
- **Remove:** review the confirmation, then select Remove document. The file disappears from the active folder and cannot be downloaded while removed.
- **Restore:** expand Removed files and select Restore. Owners and managers can recover removed files when space is available in the active folder.

PDF files may be up to **3 MB each**, with up to **20 active documents per centre**. Total stored content, including removed files, is limited to **60 MB per centre**. Removing a file preserves it for recovery and does not free storage. Replacing an existing PDF with a smaller PDF can reduce storage use.

If someone else changes a document while you are editing it, refresh the folder and try again. Failed uploads or replacements do not replace the existing PDF.

## Privacy and scope

Files are private to the organisation and authorised centre staff. Download links check access each time; they are not public sharing links. This feature does not email PDFs or publish them to parents. Downloaded copies remain on the device where staff save them.

This folder stores general centre documents. Existing student records, billing, attendance and communications continue through their usual pages.

## Interface consistency record

This is an ordinary Operate extension of the existing dashboard. The implementation reuses its semantic surface, text, border and accent tokens; shared Button; Lucide icons; typography; and active-centre selection. The compact desktop list stacks its actions on mobile. Upload and document changes use inline forms; removal requires a separate confirmation. No new visual system or token changes were introduced.

Evidence checked: DocumentsClient and page source, Sidebar integration, existing Button and centre-filter components, DESIGN.md, direction brief, and the desktop/mobile list and upload captures. DESIGN.md has pre-existing vocabulary differences from the current Button implementation; this task preserves the incumbent components and does not rewrite the design system.

# Centre documents

Open **Documents** in the dashboard menu. The active centre determines which folder you see. In Combined View, choose a centre folder first. Switching the active centre switches the document folder too.

## View and download

Use **Open PDF** to view a file in a new browser tab, or **Download** to save a copy. Access requires signing in and having permission for that centre. The page shows the document name, original filename, size and last update date.

## Organise folders

Open a folder by its name. The breadcrumb above the list shows where you are; select an earlier folder or the centre name to return. Existing PDFs remain in the centre's main folder until you move them.

Owners and managers can select **New folder**, enter a name and choose **Create folder**. The new folder is created inside the currently open folder. Folder names must be different within the same parent folder; upper and lower case do not make a duplicate name distinct.

Use a folder's **Rename** action to change its name. Use a PDF's **Move** action to choose a destination folder, or the centre's main folder, then save. Moving a PDF changes its location without uploading it again. Upload PDF always adds the new PDF to the currently open folder.

Only empty folders can be removed. Move their PDFs elsewhere and remove active subfolders first. Removed PDFs still belong to their original folder: restore and move those PDFs before removing that folder. This protects their recovery location. Expand **Removed folders** to restore a folder; restore its parent first if the parent has also been removed.

Each centre may have up to **100 folders in total, including removed folders**, nested up to **8 levels deep**. Removing a folder preserves it for recovery and does not free a folder slot. PDF limits apply to the whole centre across all folders, rather than separately to each folder.

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

This is an ordinary Operate extension of the existing dashboard. The implementation reuses its semantic surface, text, border and accent tokens; shared Button; Lucide icons; typography; and active-centre selection. The compact desktop list stacks its actions on mobile. Upload, folder creation and document changes use inline forms; removal requires a separate confirmation. Subfolders add breadcrumbs and folder rows within the same list language. No new visual system or token changes were introduced.

Evidence checked: DocumentsClient and page source, Sidebar integration, existing Button and centre-filter components, DESIGN.md, direction brief, and the desktop/mobile list and upload captures. DESIGN.md has pre-existing vocabulary differences from the current Button implementation; this task preserves the incumbent components and does not rewrite the design system.

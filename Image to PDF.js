import { LightningElement, api } from "lwc";
import saveTheChunkFile from "@salesforce/apex/FileUploadService.saveTheChunkFile";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import PDF_LIB from "@salesforce/resourceUrl/pdflib";
import { loadScript } from "lightning/platformResourceLoader";
const MAX_FILE_SIZE = 4500000;
const CHUNK_SIZE = 750000;
export default class ConvertImagetoPDF extends LightningElement {
  @api recordId;

  fileName = "";
  filesUploaded = [];
  isLoading = false;
  fileSize;
  filetype;
  renderedCallback() {
    loadScript(this, PDF_LIB).then(() => {});
  }

  handleFilesChange(event) {
    if (event.target.files != null) {
      this.processFilesToConvert(event.target.files);
    }
  }
  async processFilesToConvert(files) {
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        await this.createFileContent(files[i]);
      }
    }
  }
  async createFileContent(file) {
    this.showSpinner = true;
    this.fileName = file.name;
    this.filetype = file.type;
    var reader = new FileReader();
    var self = this;
    reader.onload = function () {
      var fileContents = reader.result;
      var base64Mark = "base64,";
      var dataStart = fileContents.indexOf(base64Mark) + base64Mark.length;
      fileContents = fileContents.substring(dataStart);
      if (self.filetype != "application/pdf")
        self.embedImageFile(fileContents, self.filetype);
      else self.prepareFileToUpload(fileContents);
    };
    reader.readAsDataURL(file);

    await new Promise((resolve, reject) => setTimeout(resolve, 3000));
  }
  async embedImageFile(file, filetype) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    let imageFile = "";
    if (filetype == "image/png") imageFile = await pdfDoc.embedPng(file);
    else if (filetype == "image/jpeg") imageFile = await pdfDoc.embedJpg(file);

    let imageDims = imageFile;

    const page = pdfDoc.addPage();
    if (imageFile.width > 595) {
      const scaleValue = parseFloat(595 / imageFile.width);
      imageDims = imageFile.scale(scaleValue);
    }
    page.drawImage(imageFile, {
      x: 0,
      y: page.getHeight() - imageDims.height,
      width: imageDims.width,
      height: imageDims.height
    });
    const pdfBytes = await pdfDoc.save();
    this.prepareFileToUpload(pdfBytes);
  }
  prepareFileToUpload(pdfBytes) {
    var blob = new Blob([pdfBytes], { type: "application/pdf" });
    this.fileSize = this.formatBytes(blob.size, 2);
    if (blob.size > MAX_FILE_SIZE) {
      let message =
        "File size cannot exceed " +
        MAX_FILE_SIZE +
        " bytes.\n" +
        "Selected file size: " +
        blob.size;
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Error",
          message: message,
          variant: "error"
        })
      );
      return;
    }
    var reader = new FileReader();
    var self = this;
    reader.onload = function () {
      var fileContents = reader.result;
      var base64Mark = "base64,";
      var dataStart = fileContents.indexOf(base64Mark) + base64Mark.length;
      fileContents = fileContents.substring(dataStart);
      if (self.filetype != "application/pdf") self.upload(blob, fileContents);
      else self.upload(blob, pdfBytes);
    };
    reader.readAsDataURL(blob);
  }
  upload(file, fileContents) {
    var fromPos = 0;
    var toPos = Math.min(fileContents.length, fromPos + CHUNK_SIZE);

    this.uploadChunk(file, fileContents, fromPos, toPos, "");
  }

  uploadChunk(file, fileContents, fromPos, toPos, attachId) {
    this.isLoading = true;
    var chunk = fileContents.substring(fromPos, toPos);

    saveTheChunkFile({
      parentId: this.recordId,
      fileName: file.name,
      base64Data: encodeURIComponent(chunk),
      contentType: file.type,
      fileId: attachId
    })
      .then((result) => {
        attachId = result;
        fromPos = toPos;
        toPos = Math.min(fileContents.length, fromPos + CHUNK_SIZE);
        if (fromPos < toPos) {
          this.uploadChunk(file, fileContents, fromPos, toPos, attachId);
        } else {
          this.dispatchEvent(
            new ShowToastEvent({
              title: "Success!",
              message: "File Upload Success",
              variant: "success"
            })
          );
          this.isLoading = false;
        }
      })
      .catch((error) => {
        console.error("Error: ", error);
      })
      .finally(() => {});
  }

  formatBytes(bytes, decimals) {
    if (bytes == 0) return "0 Bytes";
    var k = 1024,
      dm = decimals || 2,
      sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
import multer from "multer";

// verify actual PDF magic bytes — browsers can fake MIME types
// every valid PDF starts with %PDF- in the first 5 bytes
function isPDFBuffer(buffer) {
  if (!buffer || buffer.length < 5) return false;
  return buffer.slice(0, 5).toString("ascii") === "%PDF-";
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // first check MIME type
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are allowed"), false);
  }
  // magic bytes check happens after buffer is available — done in controller
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

export { isPDFBuffer };

import { Injectable } from "@angular/core";

import {
  faAndroid,
  faApple,
  faChrome,
  faFirefox,
  faJava,
  faJs,
  faLinux,
  faPhp,
  faPython,
  faRedhat,
  faUbuntu,
  faWindows,
} from "@fortawesome/free-brands-svg-icons";

import {
  faEnvelope,
  faFile,
  faFileAlt,
  faFileArchive,
  faFileAudio,
  faFileCode,
  faFileExcel,
  faFileImage,
  faFilePdf,
  faFilePowerpoint,
  faFileVideo,
  faFileWord,
} from "@fortawesome/free-regular-svg-icons";

import {
  faArchive,
  faBook,
  faCogs,
  faDatabase,
  faDotCircle,
  faFilm,
  faLock,
  faQuestion,
  faShare,
  faSitemap,
  faTerminal,
} from "@fortawesome/free-solid-svg-icons";

export { IconDefinition } from "@fortawesome/free-regular-svg-icons";

@Injectable()
export class IconService {
  get(etype: string, ftype: string) {
    if (etype != "binary") {
      return faQuestion;
    }

    switch (ftype) {
      case "image/bmp":
      case "image/cursor":
      case "image/gif":
      case "image/icon":
      case "image/jpg":
      case "image/png":
      case "image/svg":
      case "image/tga":
      case "image/tiff":
      case "image/webp":
      case "image/wmf":
        return faFileImage;

      case "executable/windows/dll64":
      case "executable/dll32":
        return faCogs;

      case "executable/windows/dos":
      case "executable/windows/pe64":
      case "executable/windows/pe32":
      case "executable/windows/pe":
      case "executable/windows/com":
      case "executable/pe":
      case "executable/pe32":
      case "executable/pe64":
        return faWindows;

      case "android/apk":
        return faAndroid;

      case "application/chrome/extension":
        return faChrome;

      case "application/mozilla/extension":
        return faFirefox;

      case "executable/mach-o":
        return faApple;

      case "executable/linux/elf32":
      case "executable/linux/elf64":
        return faLinux;

      case "archive/rpm":
        return faRedhat;

      case "archive/deb":
        return faUbuntu;

      case "document/email":
      case "document/office/email":
        return faEnvelope;

      case "code/html":
      case "code/xml":
      case "document/xml":
        return faFileCode;

      case "archive/cabinet":
      case "archive/rar":
      case "archive/tar":
        return faArchive;

      case "archive/bzip2":
      case "archive/gzip":
      case "archive/7-zip":
      case "archive/arj":
      case "archive/lzip":
      case "archive/zip":
        return faFileArchive;

      case "document/pdf":
      case "document/pdf/portfolio":
        return faFilePdf;

      // Handled in the default case
      // case "text/*":
      // case "code/*":
      case "sff":
      case "archive/udf":
      case "log/vipermonkey":
        return faFileAlt;

      case "code/php":
        return faPhp;

      case "code/class":
      case "java/class":
        return faJava;

      case "code/javascript":
        return faJs;

      case "code/python":
        return faPython;

      case "code/shell":
        return faTerminal;

      case "network/tcpdump":
        return faSitemap;

      case "archive/iso":
        return faDotCircle;

      case "document/installer/windows":
      case "installer/windows":
        return faDatabase;

      case "archive/chm":
        return faBook;

      case "document/office/passwordprotected":
      case "document/pdf/passwordprotected":
        return faLock;

      case "document/office/word":
      case "document/office/unknown":
        return faFileWord;

      case "document/office/excel":
      case "document/odt/spreadsheet":
      case "document/lotus/spreadsheet":
        return faFileExcel;

      case "document/office/powerpoint":
      case "document/odt/presentation":
        return faFilePowerpoint;

      case "meta/shortcut/windows":
        return faShare;

      case "audio/midi":
      case "audio/mp2":
      case "audio/mp3":
      case "audio/mp4":
      case "audio/ogg":
      case "audio/s3m":
      case "audio/wav":
        return faFileAudio;

      case "video/asf":
      case "video/avi":
      case "video/divx":
      case "video/mp4":
      case "video/quicktime":
        return faFileVideo;

      case "audiovisual/flash":
        return faFilm;

      default:
        // Handle complex cases like regex and startsWith here, to minimise it's usage.
        if (typeof ftype !== "string") {
          return faFile;
        }
        switch (true) {
          case ftype.startsWith("text/"):
          case ftype.startsWith("code/"):
            return faFileAlt;
          default:
            return faFile;
        }
    }
  }
}

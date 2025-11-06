import { Injectable } from "@angular/core";

import {
  faApple,
  faAndroid,
  faChrome,
  faJava,
  faJs,
  faLinux,
  faPhp,
  faPython,
  faUbuntu,
  faRedhat,
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
  faHdd,
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
      case "JPEG":
      case "GIF":
      case "PNG":
      case "ICO":
      case "SVG":
      case "TIFF":
        return faFileImage;

      case "Win32 EXE":
      case "DOS COM":
      case "DOS EXE":
      case "Portable Executable":
        return faWindows;

      case "Win32 DLL":
        return faCogs;

      case "Android":
        return faAndroid;

      case "Chrome Extension":
        return faChrome;

      case "Mach-O":
        return faApple;

      case "ELF":
        return faLinux;

      case "Linux RPM package":
        return faRedhat;

      case "Debian Package":
        return faUbuntu;

      case "Email":
      case "Outlook":
        return faEnvelope;

      case "HTML":
      case "XML":
        return faFileCode;

      case "CAB":
      case "MS Compress":
      case "RAR":
      case "TAR":
        return faArchive;

      case "BZIP":
      case "GZIP":
      case "7ZIP":
      case "ARJ":
      case "ZIP":
        return faFileArchive;

      case "PDF":
        return faFilePdf;

      case "Text":
      case "Rich Text Format":
      case "VBA":
      case "EPS":
        return faFileAlt;

      case "PHP":
        return faPhp;

      case "Java Bytecode":
        return faJava;

      case "JavaScript":
        return faJs;

      case "Python":
        return faPython;

      case "Powershell":
        return faTerminal;

      case "Network capture":
        return faSitemap;

      case "ISO":
        return faDotCircle;

      case "Macintosh Disk Image":
        return faHdd;

      case "Windows Installer":
        return faDatabase;

      case "Compiled HTML Help":
        return faBook;

      case "MS Encrypted Document":
        return faLock;

      case "MS Word Document":
      case "Office Open XML Document":
      case "Hangul (Korean) Word Processor document":
      case "Hangul (Korean] Word Processor document":
        return faFileWord;

      case "MS Excel Spreadsheet":
      case "Office Open XML Spreadsheet":
        return faFileExcel;

      case "MS PowerPoint Presentation":
      case "Office Open XML Presentation":
        return faFilePowerpoint;

      case "Windows shortcut":
        return faShare;

      case "MP3":
        return faFileAudio;

      case "MP4":
        return faFileVideo;

      case "Flash":
        return faFilm;

      default:
        return faFile;
    }
  }
}

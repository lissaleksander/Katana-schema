// Datamodell – se designdokumentet, avsnitt "Datamodell" och "Sparfilens format".

export type Lang = 'sv' | 'en';

export type Category = 'class' | 'openGym' | 'party' | 'camp' | 'other';
export const CATEGORIES: Category[] = ['class', 'openGym', 'party', 'camp', 'other'];

export interface Coach {
  id: string;
  name: string;
  /** Bakgrundsfärg på namnlappen, #RRGGBB */
  color: string;
  /** Textfärg; saknas den väljs svart/vit automatiskt */
  textColor?: string;
  active: boolean;
}

export interface ActivityType {
  id: string;
  nameSv: string;
  nameEn: string;
  category: Category;
  /** Standardtid "HH:MM" */
  start: string;
  end: string;
  active: boolean;
}

export type MonthStatus = 'draft' | 'published';

export interface Month {
  year: number;
  /** 1–12 */
  month: number;
  status: MonthStatus;
  /** ISO-tidpunkt för senaste export */
  lastExportedAt?: string;
  /** Fingeravtryck av månadens innehåll vid senaste export, för att se om något ändrats efteråt */
  exportedHash?: string;
}

export interface PartyDetails {
  /** E-post till beställaren – visas aldrig i exporten */
  contact: string;
  age?: number;
  childCount?: number;
  note?: string;
}

export interface Activity {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Bara för läger: sista dagen, "YYYY-MM-DD" */
  endDate?: string;
  start: string;
  end: string;
  typeId: string;
  customTitle?: string;
  /** Ordningen styr ordningen på namnlapparna */
  coachIds: string[];
  note?: string;
  party?: PartyDetails;
}

export interface Settings {
  gymName: string;
  /** Logga som data-URL */
  logoDataUrl?: string;
  exportLang: Lang;
}

export interface AppData {
  version: 1;
  settings: Settings;
  coaches: Coach[];
  activityTypes: ActivityType[];
  months: Month[];
  activities: Activity[];
}

export const DATA_VERSION = 1 as const;

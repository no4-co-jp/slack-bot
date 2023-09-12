import { sheets } from "@googleapis/sheets";
import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { cache } from "~/cache";

const api = sheets("v4");

export const fetchWFOUsers = async (date: Date): Promise<string[]> => {
  const targetDate = format(utcToZonedTime(date, "Asia/Tokyo"), "yyyy/MM/dd");

  const key = `google.sheets.wfo.users.list.${targetDate}`;
  const cached = cache.get<string[]>(key);

  if (cached) {
    console.log(`[Cache Hit]${key}`);
    return cached;
  }

  const targetMonth = format(utcToZonedTime(date, "Asia/Tokyo"), "yyyy/M");

  const spreadsheetId = process.env.GOOGLE_SHEET_ID_WFO ?? "";

  const auth = process.env.GOOGLE_API_KEY ?? "";

  const targetRow = utcToZonedTime(date, "Asia/Tokyo").getDate() + 3;

  try {
    const {
      data: { values: header },
    } = await api.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: `${targetMonth}!G2:BA2`,
    });

    const {
      data: { values: records },
    } = await api.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: `${targetMonth}!G${targetRow}:BA${targetRow}`,
    });

    const users = (records?.[0] ?? []).reduce<string[]>(
      (prev: string[], item: string, index: number): string[] => {
        if (!["◎", "○"].includes(item.trim())) {
          return prev;
        }
        const userId = String((header?.[0] ?? [])[index]);
        if (userId === undefined || userId.trim().length === 0) {
          return prev;
        }
        return [...prev, userId];
      },
      []
    );

    cache.set<string[]>(key, users, 60);

    return users;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const fetchLeaveUsers = async (date: Date): Promise<string[]> => {
  const targetDate = format(utcToZonedTime(date, "Asia/Tokyo"), "yyyy/MM/dd");

  const key = `google.sheets.leave.users.list.${targetDate}`;
  const cached = cache.get<string[]>(key);

  if (cached) {
    console.log(`[Cache Hit]${key}`);
    return cached;
  }

  const targetMonth = format(utcToZonedTime(date, "Asia/Tokyo"), "yyyy/M");

  const spreadsheetId = process.env.GOOGLE_SHEET_ID_WFO ?? ""; // TODO

  const auth = process.env.GOOGLE_API_KEY ?? "";

  const targetRow = utcToZonedTime(date, "Asia/Tokyo").getDate() + 3;

  try {
    const {
      data: { values: header },
    } = await api.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: `${targetMonth}!G2:BA2`,
    });

    const {
      data: { values: records },
    } = await api.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: `${targetMonth}!G${targetRow}:BA${targetRow}`,
    });

    const users = (records?.[0] ?? []).reduce<string[]>(
      (prev: string[], item: string, index: number): string[] => {
        if (!["休"].includes(item.trim())) {
          return prev;
        }
        const userId = String((header?.[0] ?? [])[index]);
        if (userId === undefined || userId.trim().length === 0) {
          return prev;
        }
        return [...prev, userId];
      },
      []
    );

    cache.set<string[]>(key, users, 60);

    return users;
  } catch (error) {
    console.error(error);
    return [];
  }
};

import { format } from "date-fns";
import { z } from "zod";
import { ja } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";
import { cache } from "~/cache";

const HolidaysSchema = z.record(z.string());

type Holidays = z.infer<typeof HolidaysSchema>;

const fetchHolidays = async (year: number | string): Promise<Holidays> => {
  const key = `holidays.sheets.wfo.users.list.${year}`;
  const cached = cache.get<Holidays>(key);

  if (cached) {
    console.log(`[Cache Hit]${key}`);
    return cached;
  }

  const response = HolidaysSchema.parse(
    await (
      await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`)
    ).json()
  );
  cache.set<Holidays>(key, response, 60 * 60 * 24);

  return response;
};

export const isHoliday = async (date: Date): Promise<boolean> => {
  const holidays = await fetchHolidays(date.getFullYear());
  return (
    format(utcToZonedTime(date, "Asia/Tokyo"), `yyyy-MM-dd`, {
      locale: ja,
    }) in Object.keys(holidays)
  );
};

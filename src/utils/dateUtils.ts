import dayjs from "dayjs";

import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ_SEOUL = "Asia/Seoul";

export const now = () => dayjs().tz(TZ_SEOUL);

export const strToDate = (dateStr: string) => {
  dayjs().tz(TZ_SEOUL);
  return dayjs(dateStr, "YYYY-MM-DD").tz(TZ_SEOUL);
};

const dateParser = (dateStr: string) => {
  const dayjsDate = strToDate(dateStr);
  const date = dayjsDate.toDate();
};

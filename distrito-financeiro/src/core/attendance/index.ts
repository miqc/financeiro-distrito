import type { AttendanceItem, Service } from '../../types';

export function getAttendanceServiceItems(
  attendance: Service,
): readonly AttendanceItem[] {
  return attendance.serviceItems?.length
    ? attendance.serviceItems
    : [
        {
          description: attendance.description,
          amount: attendance.amount,
        },
      ];
}

export function getAttendanceProductItems(
  attendance: Service,
): readonly AttendanceItem[] {
  if (attendance.productItems?.length) return attendance.productItems;
  return attendance.product ? [attendance.product] : [];
}

export function sumAttendanceItems(items: readonly AttendanceItem[]): number {
  return items.reduce((total, item) => total + item.amount, 0);
}

export function getAttendanceServiceAmount(attendance: Service): number {
  return sumAttendanceItems(getAttendanceServiceItems(attendance));
}

export function getAttendanceProductAmount(attendance: Service): number {
  return sumAttendanceItems(getAttendanceProductItems(attendance));
}

export function getAttendanceTotal(attendance: Service): number {
  return (
    getAttendanceServiceAmount(attendance) +
    getAttendanceProductAmount(attendance)
  );
}

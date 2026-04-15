import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.refreshToken.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.breakEntry.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.timeOffRequest.deleteMany();
  await prisma.timeOffType.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.userWorkScheduleAssignment.deleteMany();
  await prisma.workScheduleDay.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({ data: { name: 'TimeFlow Demo Co', timezone: 'America/New_York' } });
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const [admin, manager, e1, e2, e3] = await Promise.all([
    prisma.user.create({ data: { companyId: company.id, name: 'Alice Admin', email: 'admin@timeflow.dev', role: 'admin', passwordHash, timezone: 'America/New_York' } }),
    prisma.user.create({ data: { companyId: company.id, name: 'Mark Manager', email: 'manager@timeflow.dev', role: 'manager', passwordHash, timezone: 'America/New_York' } }),
    prisma.user.create({ data: { companyId: company.id, name: 'Evan Employee', email: 'evan@timeflow.dev', role: 'employee', passwordHash, timezone: 'America/New_York' } }),
    prisma.user.create({ data: { companyId: company.id, name: 'Nina Employee', email: 'nina@timeflow.dev', role: 'employee', passwordHash, timezone: 'America/New_York' } }),
    prisma.user.create({ data: { companyId: company.id, name: 'Omar Employee', email: 'omar@timeflow.dev', role: 'employee', passwordHash, timezone: 'America/New_York' } }),
  ]);

  const weekdaySchedule = await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: 'Standard 9-5',
      startTime: '09:00',
      endTime: '17:00',
      breakMinutes: 60,
      weeklyHours: 40,
      days: { create: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, scheduledMinutes: 480 })) },
    },
  });

  const supportSchedule = await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: 'Support Shift',
      startTime: '08:00',
      endTime: '16:00',
      breakMinutes: 45,
      weeklyHours: 40,
      days: { create: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, scheduledMinutes: 480 })) },
    },
  });

  for (const user of [admin, manager, e1, e2, e3]) {
    await prisma.userWorkScheduleAssignment.create({ data: { userId: user.id, workScheduleId: weekdaySchedule.id, startsOn: dayjs().subtract(30, 'day').toDate() } });
  }
  await prisma.userWorkScheduleAssignment.create({ data: { userId: e3.id, workScheduleId: supportSchedule.id, startsOn: dayjs().subtract(20, 'day').toDate() } });

  await prisma.holiday.createMany({
    data: [
      { companyId: company.id, name: 'Memorial Day', holidayDate: dayjs().add(20, 'day').toDate(), type: 'public' },
      { companyId: company.id, name: 'Independence Day', holidayDate: dayjs().add(60, 'day').toDate(), type: 'public' },
      { companyId: company.id, name: 'Company Retreat', holidayDate: dayjs().add(90, 'day').toDate(), type: 'company' },
    ],
  });

  const [vacation, sick] = await Promise.all([
    prisma.timeOffType.create({ data: { companyId: company.id, name: 'Vacation', description: 'Paid vacation leave' } }),
    prisma.timeOffType.create({ data: { companyId: company.id, name: 'Sick Leave', description: 'Health-related leave' } }),
  ]);

  await prisma.timeOffRequest.createMany({
    data: [
      { companyId: company.id, userId: e1.id, timeOffTypeId: vacation.id, startDate: dayjs().add(10, 'day').toDate(), endDate: dayjs().add(12, 'day').toDate(), status: 'approved' },
      { companyId: company.id, userId: e2.id, timeOffTypeId: sick.id, startDate: dayjs().add(5, 'day').toDate(), endDate: dayjs().add(6, 'day').toDate(), status: 'pending' },
    ],
  });

  for (const user of [e1, e2, e3]) {
    for (let i = 1; i <= 7; i += 1) {
      const clockIn = dayjs().subtract(i, 'day').hour(9).minute(0).second(0).millisecond(0);
      const clockOut = clockIn.add(8 + (i % 2), 'hour');
      const breakMinutes = 45;
      const workedMinutes = clockOut.diff(clockIn, 'minute') - breakMinutes;
      await prisma.timeEntry.create({
        data: {
          companyId: company.id,
          userId: user.id,
          clockIn: clockIn.toDate(),
          clockOut: clockOut.toDate(),
          breakMinutes,
          workedMinutes,
          overtimeMinutes: Math.max(0, workedMinutes - 480),
          status: 'closed',
          breaks: {
            create: [{ userId: user.id, startAt: clockIn.add(3, 'hour').toDate(), endAt: clockIn.add(3, 'hour').add(45, 'minute').toDate(), minutes: 45 }],
          },
        },
      });
    }
  }

  await prisma.activity.createMany({
    data: [
      { companyId: company.id, userId: e1.id, type: 'clocked_in', message: 'Evan clocked in' },
      { companyId: company.id, userId: e1.id, type: 'break_started', message: 'Evan started break' },
      { companyId: company.id, userId: e2.id, type: 'leave_requested', message: 'Nina requested leave' },
      { companyId: company.id, userId: manager.id, type: 'leave_approved', message: 'Mark approved leave request' },
    ],
  });

  console.log('Seed completed');
}

main().finally(() => prisma.$disconnect());

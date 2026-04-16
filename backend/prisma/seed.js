import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

function t(time) {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

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

  const [admin, manager, employee1, employee2] = await Promise.all([
    prisma.user.create({ data: { companyId: company.id, name: 'Alice Admin', email: 'admin@timeflow.dev', role: 'admin', password: passwordHash, timezone: 'America/New_York' } }),
    prisma.user.create({ data: { companyId: company.id, name: 'Mark Manager', email: 'manager@timeflow.dev', role: 'manager', password: passwordHash, timezone: 'America/New_York' } }),
    prisma.user.create({ data: { companyId: company.id, name: 'Evan Employee', email: 'evan@timeflow.dev', role: 'employee', password: passwordHash, timezone: 'America/New_York' } }),
    prisma.user.create({ data: { companyId: company.id, name: 'Nina Employee', email: 'nina@timeflow.dev', role: 'employee', password: passwordHash, timezone: 'America/New_York' } }),
  ]);

  const standardSchedule = await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: 'Standard 9-5',
      startTime: t('09:00'),
      endTime: t('17:00'),
      breakMinutes: 60,
      weeklyHours: 40,
      workScheduleDays: {
        create: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((dayName) => ({
          dayName,
          isWorking: true,
          startTime: t('09:00'),
          endTime: t('17:00'),
        })),
      },
    },
  });

  const supportSchedule = await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: 'Support Shift',
      startTime: t('08:00'),
      endTime: t('16:00'),
      breakMinutes: 45,
      weeklyHours: 40,
      workScheduleDays: {
        create: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((dayName) => ({
          dayName,
          isWorking: true,
          startTime: t('08:00'),
          endTime: t('16:00'),
        })),
      },
    },
  });

  for (const user of [admin, manager, employee1, employee2]) {
    await prisma.userWorkScheduleAssignment.create({
      data: {
        userId: user.id,
        workScheduleId: standardSchedule.id,
        effectiveFrom: dayjs().subtract(45, 'day').startOf('day').toDate(),
      },
    });
  }

  await prisma.userWorkScheduleAssignment.create({
    data: {
      userId: employee2.id,
      workScheduleId: supportSchedule.id,
      effectiveFrom: dayjs().subtract(10, 'day').startOf('day').toDate(),
    },
  });

  await prisma.holiday.createMany({
    data: [
      { companyId: company.id, name: 'Memorial Day', holidayDate: dayjs().add(20, 'day').toDate(), type: 'public' },
      { companyId: company.id, name: 'Independence Day', holidayDate: dayjs().add(60, 'day').toDate(), type: 'public' },
      { companyId: company.id, name: 'Company Retreat', holidayDate: dayjs().add(90, 'day').toDate(), type: 'company' },
    ],
  });

  const [vacationType, sickType] = await Promise.all([
    prisma.timeOffType.create({ data: { companyId: company.id, name: 'Vacation', color: '#4f46e5', isPaid: true } }),
    prisma.timeOffType.create({ data: { companyId: company.id, name: 'Sick Leave', color: '#ef4444', isPaid: true } }),
  ]);

  await prisma.timeOffRequest.createMany({
    data: [
      {
        companyId: company.id,
        userId: employee1.id,
        timeOffTypeId: vacationType.id,
        startDate: dayjs().add(10, 'day').toDate(),
        endDate: dayjs().add(12, 'day').toDate(),
        status: 'approved',
      },
      {
        companyId: company.id,
        userId: employee2.id,
        timeOffTypeId: sickType.id,
        startDate: dayjs().add(5, 'day').toDate(),
        endDate: dayjs().add(6, 'day').toDate(),
        status: 'pending',
      },
    ],
  });

  const usersForEntries = [admin, manager, employee1, employee2];

  for (const user of usersForEntries) {
    for (let i = 1; i <= 7; i += 1) {
      const clockIn = dayjs().subtract(i, 'day').hour(9).minute(0).second(0).millisecond(0);
      const breakStart = clockIn.add(3, 'hour');
      const breakEnd = breakStart.add(45, 'minute');
      const clockOut = clockIn.add(8, 'hour').add(30, 'minute');
      const totalBreakMinutes = 45;
      const totalWorkMinutes = clockOut.diff(clockIn, 'minute') - totalBreakMinutes;

      await prisma.timeEntry.create({
        data: {
          companyId: company.id,
          userId: user.id,
          workScheduleId: standardSchedule.id,
          entryDate: clockIn.startOf('day').toDate(),
          clockIn: clockIn.toDate(),
          clockOut: clockOut.toDate(),
          totalWorkMinutes,
          totalBreakMinutes,
          overtimeMinutes: Math.max(0, totalWorkMinutes - 480),
          status: 'completed',
          breakEntries: {
            create: [{
              breakStart: breakStart.toDate(),
              breakEnd: breakEnd.toDate(),
              totalMinutes: 45,
              status: 'completed',
            }],
          },
        },
      });
    }
  }

  const activeClockIn = dayjs().subtract(95, 'minute');
  await prisma.timeEntry.create({
    data: {
      companyId: company.id,
      userId: admin.id,
      workScheduleId: standardSchedule.id,
      entryDate: dayjs().startOf('day').toDate(),
      clockIn: activeClockIn.toDate(),
      status: 'active',
      breakEntries: {
        create: [{
          breakStart: dayjs().subtract(15, 'minute').toDate(),
          status: 'active',
        }],
      },
    },
  });

  await prisma.activity.createMany({
    data: [
      { companyId: company.id, userId: admin.id, type: 'clocked_in', title: 'Clocked in', description: 'Alice clocked in' },
      { companyId: company.id, userId: admin.id, type: 'break_started', title: 'Break started', description: 'Alice started a break' },
      { companyId: company.id, userId: employee1.id, type: 'leave_requested', title: 'Leave requested', description: 'Evan requested leave' },
      { companyId: company.id, userId: manager.id, type: 'leave_approved', title: 'Leave approved', description: 'Mark approved leave request' },
    ],
  });

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

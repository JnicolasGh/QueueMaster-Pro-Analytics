import { Ticket, Category } from '../types';
import { addDays, subMonths, startOfDay, setHours, setMinutes, format } from 'date-fns';

export function generateSyntheticData(categories: Category[]): Ticket[] {
  const tickets: Ticket[] = [];
  const startDate = subMonths(new Date(), 6);
  const endDate = new Date();
  
  let currentId = 1;

  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    // More traffic on weekdays, less on weekends
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseVolume = isWeekend ? 20 : 60;
    const volume = baseVolume + Math.floor(Math.random() * 40);

    for (let i = 0; i < volume; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      // Peak hours: 10-12 and 14-16
      let hour = 8 + Math.floor(Math.random() * 10);
      if (Math.random() > 0.5) {
        hour = (Math.random() > 0.5) ? 10 + Math.floor(Math.random() * 2) : 14 + Math.floor(Math.random() * 2);
      }

      const minute = Math.floor(Math.random() * 60);
      const arrivalTime = setMinutes(setHours(startOfDay(d), hour), minute).getTime();
      
      // Wait time: 5 to 45 minutes
      const waitTime = (5 + Math.floor(Math.random() * 40)) * 60 * 1000;
      const calledAt = arrivalTime + waitTime;
      
      // Service time: 3 to 20 minutes
      const serviceTime = (3 + Math.floor(Math.random() * 17)) * 60 * 1000;
      const completedAt = calledAt + serviceTime;

      // Abandonment rate: ~10%
      const isNoShow = Math.random() < 0.1;

      // Random document (8 digits)
      const customerDocument = Math.floor(10000000 + Math.random() * 90000000).toString();
      
      // Random sub-category if available
      const subCategoryId = category.subCategories && category.subCategories.length > 0
        ? category.subCategories[Math.floor(Math.random() * category.subCategories.length)].id
        : undefined;

      tickets.push({
        id: `synth-${currentId}`,
        displayId: `${category.prefix}${String(currentId % 1000).padStart(3, '0')}`,
        categoryId: category.id,
        subCategoryId,
        customerDocument,
        status: isNoShow ? 'no-show' : 'completed',
        createdAt: arrivalTime,
        calledAt: calledAt,
        startedAt: calledAt, // Simplified: call and start are same for synth
        completedAt: isNoShow ? undefined : completedAt,
        counterId: 1 + Math.floor(Math.random() * 5)
      });

      currentId++;
    }
  }

  return tickets;
}

const MS_PER_DAY = 86_400_000;

export function normalizeDate(value, fallbackMonth = 7, fallbackDay = 1) {
  if (typeof value === 'number' && Number.isInteger(value)) return `${value}-${String(fallbackMonth).padStart(2,'0')}-${String(fallbackDay).padStart(2,'0')}`;
  if (typeof value !== 'string') throw new TypeError('Date must be an ISO date or calendar year.');
  if (/^\d{4}$/.test(value)) return `${value}-${String(fallbackMonth).padStart(2,'0')}-${String(fallbackDay).padStart(2,'0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new TypeError(`Invalid date: ${value}`);
  return value;
}

export function ageOnDate(person, date) {
  const target = normalizeDate(date);
  if (person.birthDate) {
    const [y,m,d] = person.birthDate.split('-').map(Number);
    const [ty,tm,td] = target.split('-').map(Number);
    return ty-y-((tm<m || (tm===m && td<d)) ? 1 : 0);
  }
  if (Number.isInteger(person.birthYear)) return Number(target.slice(0,4))-person.birthYear;
  throw new TypeError(`Person ${person.id ?? 'unknown'} requires birthDate or birthYear.`);
}

export function resolvePeople(people) {
  const reference = people.find(person=>person.isReference) ?? people[0];
  if (!reference) throw new TypeError('At least one person is required.');
  return people.map(person=>{
    if (person.birthDate || Number.isInteger(person.birthYear)) return {...person};
    if (!Number.isInteger(person.ageOffsetFromReference)) throw new TypeError(`Person ${person.id} requires birth information or age offset.`);
    if (reference.birthDate) {
      const year=Number(reference.birthDate.slice(0,4))-person.ageOffsetFromReference;
      return {...person,birthDate:`${year}${reference.birthDate.slice(4)}`,birthResolution:'ageOffset'};
    }
    return {...person,birthYear:reference.birthYear-person.ageOffsetFromReference,birthResolution:'ageOffset'};
  });
}

export function resolveEventDate(event, people, defaultMonth = 7, defaultDay = 1) {
  if (event.date || event.year) return normalizeDate(event.date ?? event.year,defaultMonth,defaultDay);
  if (!Number.isInteger(event.age) || !event.personId) throw new TypeError(`Event ${event.id} requires date/year or age + personId.`);
  const person=people.find(item=>item.id===event.personId);
  if (!person) throw new TypeError(`Event ${event.id} references missing person ${event.personId}.`);
  if (person.birthDate) {
    const year=Number(person.birthDate.slice(0,4))+event.age;
    return `${year}${person.birthDate.slice(4)}`;
  }
  return `${person.birthYear+event.age}-${String(defaultMonth).padStart(2,'0')}-${String(defaultDay).padStart(2,'0')}`;
}

export function daysBetween(start,end){return Math.max(0,Math.floor((Date.parse(`${normalizeDate(end)}T00:00:00Z`)-Date.parse(`${normalizeDate(start)}T00:00:00Z`))/MS_PER_DAY));}
export function serviceYearsOnDate(start,end){return daysBetween(start,end)/365.2425;}

export function buildSimulationYears(model) {
  const people=resolvePeople(model.people);
  const reference=people.find(p=>p.isReference)??people[0];
  const startYear=model.household.simulationStartYear;
  const endYear=model.household.simulationEndYear ?? ((reference.birthYear ?? Number(reference.birthDate.slice(0,4)))+95);
  if (!Number.isInteger(startYear)||!Number.isInteger(endYear)||endYear<startYear) throw new TypeError('Invalid simulation year range.');
  return Array.from({length:endYear-startYear+1},(_,i)=>startYear+i);
}

import Link from "next/link";
import { DISTRICTS, scopeLabel, SKILLS } from "@/lib/jobs/ref";
import type { JobFilters as Filters } from "@/lib/jobs/list";
import { SearchIcon } from "../icons";
import { buttonClass } from "../ui";
import { FilterDropdown } from "./FilterDropdown";

const checkClass = "size-5 shrink-0 accent-accent-dark";

function Check({ name, value, checked, label, strong }: { name: string; value: string; checked: boolean; label: string; strong?: boolean }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className={checkClass} />
      <span className={strong ? "font-medium" : ""}>{label}</span>
    </label>
  );
}

function Apply() {
  return (
    <div className="mt-3 border-t border-line pt-3">
      <button type="submit" className={`${buttonClass("primary", "sm")} w-full`}>
        הצגת משרות
      </button>
    </div>
  );
}

/**
 * The live site's search row: a pill search box, then "אזור בארץ", "כישורים",
 * "היקף משרה" and "נקה הכל". One GET form, so every choice is in the URL.
 */
export function JobFilters({ filters, cities, scopes }: { filters: Filters; cities: Map<string, { symbol: number; city: string }[]>; scopes: string[] }) {
  const locationCount = filters.districts.length + filters.cities.length;
  return (
    <form action="/" method="get" role="search" aria-label="חיפוש משרות" className="relative flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <label htmlFor="job-search" className="sr-only">
          חיפוש משרה
        </label>
        <input
          id="job-search"
          type="search"
          name="searchValue"
          defaultValue={filters.searchValue}
          placeholder="חפש את התפקיד הבא שלך..."
          className="h-12 w-full rounded-full border border-field bg-white ps-5 pe-14 text-base text-ink shadow-field placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          className="absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          <SearchIcon className="size-6" />
          <span className="sr-only">חיפוש</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <FilterDropdown label="אזור בארץ" count={locationCount}>
          <fieldset className="max-h-80 overflow-y-auto">
            <legend className="sr-only">אזור בארץ</legend>
            {DISTRICTS.map((d) => (
              <div key={d}>
                <Check name="district" value={d} checked={filters.districts.includes(d)} label={d} strong />
                {cities.get(d)?.length ? (
                  <div className="ms-6">
                    {cities.get(d)!.map((c) => (
                      <Check key={c.symbol} name="city" value={String(c.symbol)} checked={filters.cities.includes(c.symbol)} label={c.city} />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </fieldset>
          <Apply />
        </FilterDropdown>

        <FilterDropdown label="כישורים" count={filters.skills.length}>
          <fieldset className="max-h-80 overflow-y-auto">
            <legend className="sr-only">כישורים</legend>
            {SKILLS.map((s) => (
              <Check key={s.id} name="skills" value={s.id} checked={filters.skills.includes(s.id)} label={s.name} />
            ))}
          </fieldset>
          <Apply />
        </FilterDropdown>

        <FilterDropdown label="היקף משרה" count={filters.scopes.length}>
          <fieldset>
            <legend className="sr-only">היקף משרה</legend>
            {scopes.map((s) => (
              <Check key={s} name="scope" value={s} checked={filters.scopes.includes(s)} label={scopeLabel(s)} />
            ))}
          </fieldset>
          <Apply />
        </FilterDropdown>

        <Link href="/" className="flex h-12 items-center justify-center rounded-full px-5 font-medium text-accent-dark hover:bg-accent/10">
          נקה הכל
        </Link>
      </div>
    </form>
  );
}

export default function CategoryCard({ category }) {
  return (
    <article className="group rounded-3xl border border-stone-200/80 bg-white p-4 transition duration-300 hover:-translate-y-1 hover:border-[#d3c3b0] hover:shadow-[0_12px_30px_rgba(39,35,28,0.08)] sm:p-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f0e9] text-2xl transition group-hover:bg-[#eee2d2] sm:h-14 sm:w-14 sm:text-[26px]" aria-hidden="true">
        {category.icon}
      </span>
      <div className="mt-4">
        <h3 className="text-sm font-bold leading-5 text-stone-800 sm:text-base">{category.title}</h3>
        <p className="mt-1 text-xs text-stone-500">{category.count} ta mahsulot</p>
      </div>
    </article>
  );
}
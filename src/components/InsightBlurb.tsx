interface InsightBlurbProps {
  text: string;
}

export default function InsightBlurb({ text }: InsightBlurbProps) {
  return (
    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-l-2 border-blue-400 pl-3">
      {text}
    </p>
  );
}
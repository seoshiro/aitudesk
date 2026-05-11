import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Ошибка · 404
        </div>
        <h1 className="mt-5 font-serif text-[56px] leading-[0.95] tracking-[-0.02em] text-balance">
          Страница не найдена
        </h1>
        <p className="mt-5 text-[14.5px] text-muted-foreground leading-relaxed text-pretty">
          Адрес неверный или содержимое было перемещено. Вернитесь на главную и продолжайте работу.
        </p>
        <Button asChild className="mt-8">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            На главную
          </Link>
        </Button>
      </div>
    </div>
  );
}

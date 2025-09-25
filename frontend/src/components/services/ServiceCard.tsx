import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Service } from '@/lib/types';
import { ArrowRight } from 'lucide-react';

interface ServiceCardProps {
  service: Service;
  onClick: () => void;
  isDisabled?: boolean;
}

export default function ServiceCard({ service, onClick, isDisabled = false }: ServiceCardProps) {
  const Icon = service.icon;

  const handleCardClick = () => {
    if (!isDisabled) {
      onClick();
    }
  };

  return (
    <Card
      className={`flex flex-col text-center items-center justify-between p-4 transition-all duration-300 ease-in-out group bg-card ${
        isDisabled
          ? 'shadow-none'
          : 'hover:shadow-xl hover:-translate-y-2 cursor-pointer active:shadow-inner active:scale-95'
      }`}
      onClick={handleCardClick}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      onKeyDown={(e) => !isDisabled && (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <CardHeader className="p-2">
        <div className={`mx-auto bg-primary/10 text-primary p-4 rounded-full mb-4 transition-colors ${!isDisabled && 'group-hover:bg-primary group-hover:text-primary-foreground'}`}>
          <Icon className="h-10 w-10" />
        </div>
        <CardTitle className="text-lg font-bold font-headline">{service.title}</CardTitle>
        <CardDescription>{service.description}</CardDescription>
      </CardHeader>
      <CardContent className="p-2 w-full mt-auto">
        <Button
          variant="ghost"
          className={`w-full font-bold text-primary ${!isDisabled && 'group-hover:bg-accent group-hover:text-accent-foreground'}`}
          aria-label={`Realizar ${service.title}`}
          disabled={isDisabled}
        >
          <span className={`opacity-0 transition-opacity duration-300 ${!isDisabled && 'group-hover:opacity-100 group-focus-within:opacity-100'}`}>
            Ir
          </span>
          <ArrowRight className={`ml-2 h-4 w-4 opacity-0 transition-opacity duration-300 ${!isDisabled && 'group-hover:opacity-100 group-focus-within:opacity-100'}`} />
        </Button>
      </CardContent>
    </Card>
  );
}

import { BrandLockup, Button, Card, CardContent } from '@phenix360/ui';
import { ArrowRight, HardHat, Sparkles } from 'lucide-react';

/**
 * Écran de bienvenue (Lot 1 — App réelle locale). Au tout premier lancement, on
 * ne force plus la démo : le conducteur CHOISIT. « Découvrir la démonstration »
 * charge un chantier complet ; « Démarrer à vide » ouvre un espace propre, prêt
 * pour ses vrais chantiers. Le choix se fait une seule fois. VISION Art. 11.
 */
export function Welcome({
  onDemo,
  onBlank,
}: {
  onDemo: () => void;
  onBlank: () => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
      <div className="space-y-2 text-center">
        <BrandLockup size="lg" subtitle className="mx-auto justify-center" />
        <h1 className="pt-6 font-serif text-3xl font-semibold tracking-tight text-foreground">
          Bienvenue
        </h1>
        <p className="text-base text-muted-foreground">Comment souhaitez-vous commencer&nbsp;?</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-4 p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-5">
              <Sparkles aria-hidden />
            </span>
            <div className="flex-1 space-y-1.5">
              <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                Découvrir la démonstration
              </h2>
              <p className="text-sm text-muted-foreground">
                Un chantier complet, déjà rempli — pour explorer PHÉNIX en deux minutes.
              </p>
            </div>
            <Button variant="outline" className="justify-center" onClick={onDemo}>
              <Sparkles aria-hidden /> Découvrir la démo
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-gold-300 shadow-gold">
          <CardContent className="flex flex-1 flex-col gap-4 p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground [&_svg]:size-5">
              <HardHat aria-hidden />
            </span>
            <div className="flex-1 space-y-1.5">
              <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                Démarrer à vide
              </h2>
              <p className="text-sm text-muted-foreground">
                Votre espace de travail, propre et prêt pour vos vrais chantiers.
              </p>
            </div>
            <Button className="justify-center" onClick={onBlank}>
              Démarrer à vide <ArrowRight aria-hidden />
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Vous pourrez recharger la démonstration ou repartir de zéro à tout moment.
      </p>
    </div>
  );
}

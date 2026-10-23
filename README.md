# Prix des fermes Minecraft

Petit outil local pour fixer le **prix plancher** d'une production de ferme, avec tes pièces : cuivre, fer, or et diamant.

Le prix dépend de :

- le **prix des intrants** consommés chaque heure
- la **production** (objets par heure)
- la **difficulté** de création, comptée comme un temps de travail, plus les matériaux de construction
- la **présence** : AFK (0), actif comme au minage (un rapport horaire réglable), ou devant la ferme (une part réglable du salaire)

La construction et le travail de création sont étalés sur les heures de marche. Le temps de jeu est payé chaque heure de production, sauf en AFK.

```
coût = intrants + construction étalée + travail étalé + temps de jeu
prix plancher = coût × (1 + marge)
prix de vente = prix saisi, sinon le plancher arrondi au supérieur si l'option est activée
```

Le résultat propose les quantités qui ont du sens pour cette ferme : 1 objet, 16, 32, 64, 3 stacks, 9 stacks, 1 shulker. Chaque ferme choisit son format de base, vendu au prix plein. Chaque format plus gros retire un pourcentage réglable du prix unitaire.

Ouvre `index.html` dans le navigateur. Les fermes restent enregistrées dans ce navigateur. L'onglet **Monnaie et règles** règle l'impact de la difficulté, du salaire, de la présence et des lots, puis exporte les données en JSON.

Le taux des pièces est fixe : 10 PC = 1 PF, 10 PF = 1 PO, 10 PO = 1 PD. Les images de cuivre, fer et or viennent de [coins-texture](https://github.com/Enta12/coins-texture).

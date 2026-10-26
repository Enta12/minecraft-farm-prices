# Prix des fermes Minecraft

Petit outil local pour fixer le **prix plancher** d'une production de ferme, avec tes pièces : cuivre, fer, or et diamant.

Le prix dépend de :

- le **prix des intrants** consommés chaque heure
- la **production** (objets par heure), ou, pour une trouvaille, une fois toutes les X heures puis Y heures de travail qui rendent Z objets
- la **difficulté** de création d'une ferme, comptée comme un temps de travail, plus les matériaux de construction
- la **présence** pendant qu'une ferme tourne : AFK (0), actif comme au minage (un rapport horaire réglable), ou devant la ferme (une part réglable du salaire)
- le **salaire de recherche**, réglé dans Monnaie et règles, payé pour chaque heure passée à trouver
- les **heures de travail** une fois la trouvaille faite, payées au rapport d'une heure active (minage)
- le **prix de l'équipement** d'une trouvaille, en pièces, étalé sur l'amortissement

La construction et le travail de création d'une ferme sont étalés sur les heures de marche. Le temps de jeu d'une ferme est payé chaque heure de production, sauf en AFK. Pour une trouvaille, la recherche et le travail sont payés à chaque cycle, à deux tarifs distincts. Les intrants et les matériaux de construction ne s'appliquent pas.

```
coût = intrants + construction étalée + travail étalé + temps de jeu
prix plancher = coût × (1 + marge)
prix de vente = prix saisi, sinon le plancher. Ce prix d'objet peut être décimal.
Les lots proposés (1, 16, shulker…) sont des prix entiers.
```

Le résultat propose les quantités qui ont du sens pour cette ferme : 1 objet, 16, 32, 64, 3 stacks, 9 stacks, 1 shulker. Chaque ferme choisit son format de base, vendu au prix plein. Chaque format plus gros retire un pourcentage réglable du prix unitaire. Le format shulker ajoute le prix d'une boîte, réglé dans Monnaie et règles, à 2 PF par défaut.

Ouvre `index.html` dans le navigateur. Les fermes restent enregistrées dans ce navigateur. L'onglet **Monnaie et règles** règle l'impact de la difficulté, du salaire, de la présence et des lots, puis exporte les données en JSON.

Le taux des pièces est fixe : 10 PC = 1 PF, 10 PF = 1 PO, 10 PO = 1 PD. Le salaire horaire de départ est 1 PO, soit 100 cuivre. Les images de cuivre, fer et or viennent de [coins-texture](https://github.com/Enta12/coins-texture).

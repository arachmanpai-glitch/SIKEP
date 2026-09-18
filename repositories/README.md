# repositories/

Data-access layer. Wraps Prisma queries behind repository functions/classes
so services never call `prisma.*` directly — keeps persistence concerns out
of business logic and makes the domain layer testable without a database.

Populated starting PHASE 2/5 alongside the corresponding domain models.

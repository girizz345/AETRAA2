#!/usr/bin/env python3
"""
errors.py — the failure taxonomy, in one place.

The distinction that matters is not what went wrong but whether retrying could
help. A rate limit is worth another attempt; a corrupt PDF never is, and
retrying it three times only delays the gap record by a few seconds and makes
the log harder to read.

Every failure names sheet, stage and operation. There is no blanket except:
an unhandled exception fails its own sheet loudly, with traceback, and the run
continues on the others.

Not a CLI.
"""
from __future__ import annotations


class BoqError(Exception):
    """Root. Carries the three things every failure must name."""

    retryable = False

    def __init__(self, message: str, *, doc_id: str | None = None,
                 stage: str | None = None, operation: str | None = None):
        super().__init__(message)
        self.message = message
        self.doc_id = doc_id
        self.stage = stage
        self.operation = operation

    def __str__(self) -> str:
        where = " · ".join(p for p in (self.stage, self.doc_id, self.operation) if p)
        return f"{self.message} [{where}]" if where else self.message


# -- transient: retry with backoff ----------------------------------------
class TransientError(BoqError):
    retryable = True


class RateLimited(TransientError):
    """Provider said slow down."""


class Timeout(TransientError):
    """No response inside the bound."""


class Truncated(TransientError):
    """Response ended mid-structure. Distinct from SchemaInvalid: this one is
    worth another call."""


# -- structural: never retry, record a gap --------------------------------
class StructuralError(BoqError):
    retryable = False


class ExtractionError(StructuralError):
    """The file cannot be read at all. Recording the gap is stage 1's job and
    it needs something to name."""


class UnreadableTitleBlock(StructuralError):
    """No pattern matched. The sheet is listed as unresolved, never guessed."""


class RefusedTier(StructuralError):
    """T3 or T4. A low-confidence number in a bid is worse than a visible gap,
    so there is no OCR fallback."""


class UncalibratedScale(StructuralError):
    """Deferred at v3.1 — kept because the rule comes back with the stage."""


# -- contract violations: these are bugs, and they halt --------------------
class ContractViolation(BoqError):
    """The pipeline was asked to do something the invariants forbid. Not a
    gap, not a retry — a halt, because the alternative is a plausible number
    with nothing behind it."""


class UnevidencedQuantity(ContractViolation):
    """A quantity cited a record that does not exist in the evidence base."""


class ModelSuppliedNumber(ContractViolation):
    """A model response carried a value where only a label was permitted.
    Invariant 1, detected rather than trusted."""


class UnknownClause(ContractViolation):
    """A clause id that is not in the ingested table."""


class RoleArityMismatch(ContractViolation):
    """Bindings do not match what the clause's formula requires — a thickness
    supplied to a linear clause, or a role missing."""


class CompletenessFailure(ContractViolation):
    """Stage 16 found evidence of a kind with no output of the corresponding
    kind, and no written justification. Blocks issue."""

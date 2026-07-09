from app.models.decision import DecisionResult, Issue


def decide(issues: list[Issue]) -> DecisionResult:
    """Locked thresholds (see CLAUDE.md section 3):
    - any hard issue (tax ID mismatch)        -> Rejected
    - zero issues                              -> Approved
    - exactly one soft issue                   -> Pending
    - two or more soft issues                  -> Rejected
    """
    hard_issues = [i for i in issues if i.severity == "hard"]
    soft_issues = [i for i in issues if i.severity == "soft"]

    if hard_issues:
        reasoning = "Rejected: " + " ".join(i.message for i in hard_issues)
        return DecisionResult(status="rejected", issues=issues, reasoning=reasoning)

    if not soft_issues:
        return DecisionResult(
            status="approved", issues=[], reasoning="All checks passed: no discrepancies found."
        )

    if len(soft_issues) == 1:
        reasoning = "Pending: " + soft_issues[0].message
        return DecisionResult(status="pending", issues=soft_issues, reasoning=reasoning)

    reasoning = (
        f"Rejected: {len(soft_issues)} separate inconsistencies found — "
        + " ".join(i.message for i in soft_issues)
    )
    return DecisionResult(status="rejected", issues=soft_issues, reasoning=reasoning)

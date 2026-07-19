# JFSC AML/CFT/CPF Handbook

An interactive web version of the Jersey Financial Services Commission's AML/CFT/CPF Handbook, built as an MkDocs site with role-based filtering, so a given reader sees the guidance that applies to them rather than the whole tome.

An unofficial reference, put together to make the material easier to work through. It does not replace the JFSC's own published handbook, which remains the authority.

## Build

Built with MkDocs.

```
cd site
mkdocs serve      # local preview
mkdocs build      # static output
```

The pipeline that turns the source into the site lives in `pipeline/` and `scripts/`.

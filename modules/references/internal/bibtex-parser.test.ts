/** Contract: contracts/references/rules.md -- Verification tests */
import { describe, it, expect } from 'vitest';
import { parseBibTeX } from './bibtex-parser.ts';

describe('parseBibTeX', () => {
  it('parses a standard article entry', () => {
    const input = `@article{smith2024,
  author = {Smith, John and Doe, Jane},
  title = {A Study of Testing},
  journal = {Journal of Software},
  year = {2024},
  volume = {12},
  number = {3},
  pages = {100--110},
  doi = {10.1234/test.2024},
  abstract = {This is the abstract.}
}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(1);
    const r = refs[0];
    expect(r.type).toBe('article-journal');
    expect(r.title).toBe('A Study of Testing');
    expect(r.authors).toEqual([
      { family: 'Smith', given: 'John' },
      { family: 'Doe', given: 'Jane' },
    ]);
    expect(r.issuedDate).toBe('2024');
    expect(r.volume).toBe('12');
    expect(r.issue).toBe('3');
    expect(r.pages).toBe('100-110');
    expect(r.doi).toBe('10.1234/test.2024');
    expect(r.abstract).toBe('This is the abstract.');
    expect(r.containerTitle).toBe('Journal of Software');
  });

  it('parses a book entry', () => {
    const input = `@book{knuth1997,
  author = {Knuth, Donald E.},
  title = {The Art of Computer Programming},
  publisher = {Addison-Wesley},
  year = {1997},
  isbn = {978-0-201-89683-1}
}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe('book');
    expect(refs[0].publisher).toBe('Addison-Wesley');
    expect(refs[0].isbn).toBe('978-0-201-89683-1');
  });

  it('parses inproceedings as paper-conference', () => {
    const input = `@inproceedings{lee2023,
  author = {Lee, Alice},
  title = {Distributed Systems Talk},
  booktitle = {Proc. ACM Conference},
  year = {2023}
}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe('paper-conference');
    expect(refs[0].containerTitle).toBe('Proc. ACM Conference');
  });

  it('handles LaTeX accents in author names', () => {
    const input = `@article{muller2020,
  author = {M\\"{u}ller, Hans and Garc\\'ia, Mar\\'ia},
  title = {Accented Authors},
  journal = {Test},
  year = {2020}
}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(1);
    expect(refs[0].authors).toEqual([
      { family: 'Müller', given: 'Hans' },
      { family: 'García', given: 'María' },
    ]);
  });

  it('handles curly-brace case preservation in titles', () => {
    const input = `@article{test,
  author = {Test, A.},
  title = {{DNA} Sequencing in {E. coli}},
  journal = {Nature},
  year = {2021}
}`;
    const refs = parseBibTeX(input);
    expect(refs[0].title).toBe('DNA Sequencing in E. coli');
  });

  it('parses multiple entries', () => {
    const input = `@article{a, author={A, B}, title={First}, year={2020}, journal={J1}}
@book{b, author={C, D}, title={Second}, year={2021}, publisher={Pub}}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(2);
    expect(refs[0].title).toBe('First');
    expect(refs[1].title).toBe('Second');
  });

  it('skips entries without a title', () => {
    const input = `@article{bad, author={Nobody}}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(0);
  });

  it('skips @comment, @preamble, @string entries', () => {
    const input = `@comment{This is a comment}
@preamble{"Some preamble"}
@string{jnl = "Journal of Things"}
@article{real, title={Real Entry}, year={2024}, journal={J}}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(1);
    expect(refs[0].title).toBe('Real Entry');
  });

  it('handles double-quoted field values', () => {
    const input = `@article{dq,
  author = "Smith, John",
  title = "Double Quoted Title",
  journal = "Some Journal",
  year = "2022"
}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(1);
    expect(refs[0].title).toBe('Double Quoted Title');
    expect(refs[0].authors[0].family).toBe('Smith');
  });

  it('handles "First Last" author format (no comma)', () => {
    const input = `@article{fl,
  author = {John Smith and Alice Bob Jones},
  title = {No Comma Format},
  year = {2023},
  journal = {Test}
}`;
    const refs = parseBibTeX(input);
    expect(refs[0].authors).toEqual([
      { family: 'Smith', given: 'John' },
      { family: 'Jones', given: 'Alice Bob' },
    ]);
  });

  it('extracts keywords as tags', () => {
    const input = `@article{kw,
  title = {Tagged Entry},
  keywords = {machine learning, NLP, transformers},
  year = {2024},
  journal = {AI}
}`;
    const refs = parseBibTeX(input);
    expect(refs[0].tags).toEqual(['machine learning', 'NLP', 'transformers']);
  });

  it('returns empty array for empty input', () => {
    expect(parseBibTeX('')).toEqual([]);
  });

  it('does not throw on malformed input', () => {
    const garbage = '@article{broken, title = {No closing brace';
    expect(() => parseBibTeX(garbage)).not.toThrow();
  });

  it('parses phdthesis as thesis type', () => {
    const input = `@phdthesis{phd1,
  author = {Researcher, Pat},
  title = {My Dissertation},
  school = {MIT},
  year = {2019}
}`;
    const refs = parseBibTeX(input);
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe('thesis');
  });
});

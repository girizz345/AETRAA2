"""
AETRAA Core - Excel house style and workbook utilities.
Every AETRAA agent's workbook uses the same look: header blocks, colour
standards, column headers, hyperlinks, cover sheet with executive summary.
"""

import os
from datetime import date
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

CLR = {
    'PASS':      'C6EFCE',
    'ADDED':     'BDD7EE',
    'REMOVED':   'F8CBAD',
    'CHANGED':   'FFD7B5',
    'LOW':       'FFE699',
    'MED':       'FFC000',
    'HIGH':      'FF0000',
    'AUDIT':     'ED7D31',
    'HEADER':    '305496',
    'SUBHDR':    'DDEBF7',
    'ALTROW':    'F2F2F2',
    'DARKRED':   'C00000',
}


def fl(hex_color):
    return PatternFill('solid', start_color=hex_color, end_color=hex_color)


def fn(bold=False, color='000000', size=10, italic=False, name='Calibri'):
    return Font(name=name, bold=bold, color=color, size=size, italic=italic)


def al(h='left', v='top', wrap=True):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)


def bd():
    s = Side(style='thin', color='BFBFBF')
    return Border(left=s, right=s, top=s, bottom=s)


def create_workbook(sheet_names):
    wb = Workbook()
    wb.remove(wb.active)
    for name in sheet_names:
        ws = wb.create_sheet(name[:31])
        ws.freeze_panes = 'A8'
    return wb


def write_header_block(ws, title, project_meta, module_name, desc=''):
    today = date.today().strftime('%Y-%m-%d')
    proj = project_meta.get('project_name', 'PROJECT')
    ws['A1'] = f"{title.upper()} - {proj.upper()}"
    ws['A1'].font = Font(name='Calibri', bold=True, size=14)
    ws['A2'] = (f"Developer: {project_meta.get('developer', '')}  |  "
                f"Location: {project_meta.get('emirate', 'UAE')}  |  "
                f"Module: {module_name}  |  Prepared: {today}  |  "
                f"By: {project_meta.get('prepared_by', 'AETRAA')}")
    ws['A2'].font = fn(italic=True, size=9)
    ws['A3'] = desc
    ws['A3'].font = fn(italic=True, size=9)
    for row in range(1, 7):
        ws.merge_cells(f'A{row}:I{row}')
        ws[f'A{row}'].alignment = al('left', 'center')


def write_col_headers(ws, headers, widths, row=7):
    for col, (hdr, w) in enumerate(zip(headers, widths), 1):
        cell = ws.cell(row=row, column=col, value=hdr)
        cell.font = Font(name='Calibri', bold=True, color='FFFFFF', size=11)
        cell.fill = fl(CLR['HEADER'])
        cell.alignment = al('center', 'center')
        cell.border = bd()
        ws.column_dimensions[get_column_letter(col)].width = w
    ws.row_dimensions[row].height = 20


def link(ws, row, col, target, workbook_dir):
    """Relative-path hyperlink on a cell, keeping its value."""
    if not target:
        return
    cell = ws.cell(row=row, column=col)
    rel = os.path.relpath(str(target), str(workbook_dir)).replace(os.sep, '/')
    cell.hyperlink = rel
    cell.font = Font(name='Calibri', size=10, color='0563C1',
                     underline='single')


def internal_link(ws, row, col, sheet_name, target_row):
    from openpyxl.worksheet.hyperlink import Hyperlink
    cell = ws.cell(row=row, column=col)
    cell.hyperlink = Hyperlink(
        ref=cell.coordinate, location=f"'{sheet_name}'!A{target_row}",
        display=str(cell.value))
    cell.font = Font(name='Calibri', size=10, color='0563C1',
                     underline='single')


def write_cover(wb, project_meta, module_name, stats, exec_lines=None,
                legend=None, sheet='Cover'):
    ws = wb[sheet]
    r = 1
    ws[f'A{r}'] = project_meta.get('project_name', 'PROJECT').upper()
    ws[f'A{r}'].font = Font(name='Calibri', bold=True, size=18)
    r += 1
    ws[f'A{r}'] = module_name.upper()
    ws[f'A{r}'].font = Font(name='Calibri', bold=True, size=14)
    r += 2

    ws[f'A{r}'] = 'PROJECT INFORMATION'
    ws[f'A{r}'].font = fn(bold=True, size=12)
    r += 1
    for label, value in [
            ('Project Name', project_meta.get('project_name', '')),
            ('Developer', project_meta.get('developer', '')),
            ('Location / Emirate', project_meta.get('emirate', '')),
            ('Module', module_name),
            ('Date Prepared', date.today().strftime('%Y-%m-%d')),
            ('Prepared By', project_meta.get('prepared_by', ''))]:
        ws[f'A{r}'] = label
        ws[f'A{r}'].font = fn(bold=True)
        ws[f'C{r}'] = str(value)
        r += 1

    r += 1
    ws[f'A{r}'] = 'SUMMARY'
    ws[f'A{r}'].font = fn(bold=True, size=12)
    r += 1
    for label, value in (stats or {}).items():
        ws[f'A{r}'] = label
        ws[f'A{r}'].font = fn(bold=True)
        ws[f'C{r}'] = value
        r += 1

    if legend:
        r += 1
        ws[f'A{r}'] = 'COLOUR LEGEND'
        ws[f'A{r}'].font = fn(bold=True, size=12)
        r += 1
        for label, color, desc in legend:
            ws[f'A{r}'].fill = fl(color)
            ws[f'B{r}'] = label
            ws[f'B{r}'].font = fn(bold=True)
            ws[f'C{r}'] = desc
            r += 1

    if exec_lines:
        r += 1
        ws[f'A{r}'] = 'EXECUTIVE SUMMARY'
        ws[f'A{r}'].font = fn(bold=True, size=12)
        r += 1
        for line in exec_lines:
            ws[f'A{r}'] = str(line)
            ws[f'A{r}'].alignment = Alignment(wrap_text=True, vertical='top')
            ws.merge_cells(f'A{r}:I{r}')
            ws.row_dimensions[r].height = max(
                18, 14 * (1 + len(str(line)) // 110))
            r += 1

    r += 1
    ws[f'A{r}'] = ('DISCLAIMER: Produced using the AETRAA platform. Based on '
                   'documents provided. Completeness of source documents is '
                   'the responsibility of the issuing party. Findings are '
                   'based on professional engineering judgement.')
    ws[f'A{r}'].alignment = Alignment(wrap_text=True)
    ws.merge_cells(f'A{r}:I{r}')
    ws.row_dimensions[r].height = 45
    ws.column_dimensions['A'].width = 30
    ws.column_dimensions['B'].width = 20
    ws.column_dimensions['C'].width = 55


def save_workbook(wb, out_dir, filename):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / filename
    wb.save(str(path))
    print(f"FILE WRITTEN: {filename}")
    return path

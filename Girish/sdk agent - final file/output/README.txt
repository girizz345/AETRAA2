RESULTS OF EVERY RUN APPEAR IN THIS FOLDER
==========================================

After a run, open the folder named after the project, for example:

   5310319 PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF) - Rev 00

It holds, ready to open:
   - BOQ Priced and BOQ Unpriced   (the Bill of Quantities)
   - Take-off                      (where every quantity comes from, line by line)
   - Provenance                    (how every figure was obtained)
   - Drawing register              (every drawing, its number and title)
   - markup                        (the drawings with the measured items marked)
   - Questions and gaps.txt        (what the drawings leave unclear - read it)
   - a zip of the bill, take-off and markups, as issued

"LATEST RUN.txt" says which folder is the newest and whether a bill was issued.
If no bill was issued, the project folder has "WHY THERE IS NO BILL.txt".

The same zip is also placed in the drawings folder, under Reports/BOQ_POMI_V1.

To run the agent (in a terminal, from the agent's folder):
   python3 agent.py "<the drawings folder>"

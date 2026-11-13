<?php
namespace App\Utils;

/** Split trusted repository SQL, including mysql-client DELIMITER procedure blocks. */
class SqlStatements
{
    public static function parse(string $sql): array
    {
        $result=[];$buffer='';$delimiter=';';$quote=null;$blockComment=false;
        foreach(preg_split('/\r\n|\n|\r/',$sql) as $line) {
            if($quote===null && !$blockComment && preg_match('/^\s*DELIMITER\s+(\S+)\s*$/i',$line,$m)) {
                if(trim($buffer)!=='')throw new \RuntimeException('DELIMITER 前有未结束的 SQL');
                $delimiter=$m[1];continue;
            }
            $length=strlen($line);
            for($i=0;$i<$length;$i++) {
                $c=$line[$i];$next=$line[$i+1]??'';
                if($blockComment) {if($c==='*'&&$next==='/'){$blockComment=false;$i++;}$buffer.=' ';continue;}
                if($quote!==null) {
                    $buffer.=$c;
                    if($c==='\\'&&$next!==''){$buffer.=$next;$i++;continue;}
                    if($c===$quote){if($next===$quote){$buffer.=$next;$i++;}else $quote=null;}
                    continue;
                }
                if($c==='/'&&$next==='*'){$blockComment=true;$i++;$buffer.=' ';continue;}
                if($c==='#'||($c==='-'&&$next==='-'&&(!isset($line[$i+2])||ctype_space($line[$i+2]))))break;
                if(substr($line,$i,strlen($delimiter))===$delimiter) {
                    if(trim($buffer)!=='')$result[]=trim($buffer);
                    $buffer='';$i+=strlen($delimiter)-1;continue;
                }
                if(in_array($c,["'",'"','`'],true))$quote=$c;
                $buffer.=$c;
            }
            $buffer.="\n";
        }
        if($quote!==null||$blockComment)throw new \RuntimeException('SQL 存在未闭合的字符串或注释');
        if(trim($buffer)!=='')$result[]=trim($buffer);
        return $result;
    }
}
